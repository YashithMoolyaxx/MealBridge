import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.db.models import Q

from apps.accounts.models import User
from apps.donations.models import DonationCard
from apps.missions.models import Mission
from apps.missions.serializers import (
    AdvancedHungerRoutingSerializer,
    MissionActionSerializer,
    MissionSerializer,
    OptimizedRouteRequestSerializer,
)
from services.geocoding import GeocodingError, geocode_address
from services.mission_flow import (
    approve_delivery,
    approve_volunteer_request,
    cancel_mission,
    confirm_delivery_scan,
    confirm_pickup_scan,
    initialize_mission,
    reject_delivery,
    reject_volunteer_request,
    request_delivery_verification,
    request_volunteer,
)
from services.routing import (
    astar_route,
    build_routing_candidates,
    optimize_pickup_route,
    pareto_routes,
    serialize_route_result,
    simulated_annealing_route,
)


logger = logging.getLogger(__name__)


class MissionViewSet(viewsets.ModelViewSet):
    serializer_class = MissionSerializer

    def get_queryset(self):
        queryset = Mission.objects.select_related(
            'donation_card',
            'requirement_card',
            'donor_user',
            'receiver_organization',
            'volunteer_user',
            'pending_volunteer',
        ).prefetch_related('events', 'qr_tokens')

        user = self.request.user
        if user.role == 'VOLUNTEER':
            queryset = queryset.filter(
                Q(volunteer_user=user) | Q(pending_volunteer=user) | Q(state=Mission.State.CREATED)
            )
        elif user.role == 'DONOR':
            queryset = queryset.filter(donor_user=user)
        elif user.role == 'RECEIVER':
            queryset = queryset.filter(receiver_organization__members__user=user)

        state = self.request.query_params.get('state')
        if state:
            queryset = queryset.filter(state=state)
        return queryset

    def perform_create(self, serializer):
        if self.request.user.role not in ['DONOR', 'ADMIN']:
            raise ValidationError('Only donors or admins can create missions directly.')
        mission = serializer.save(donor_user=self.request.user)
        initialize_mission(mission, self.request.user)

    def _resolve_volunteer_start(self, volunteer, volunteer_address=None):
        if volunteer_address:
            try:
                start_latitude, start_longitude = geocode_address(volunteer_address)
            except GeocodingError as exc:
                raise ValidationError({'volunteer_address': f'Could not geocode volunteer address: {exc}'}) from exc
            start_source = 'address_override'
        else:
            if volunteer.last_known_latitude is None or volunteer.last_known_longitude is None:
                raise ValidationError(
                    'Volunteer does not have a known location. Provide volunteer_address override.'
                )
            start_latitude = float(volunteer.last_known_latitude)
            start_longitude = float(volunteer.last_known_longitude)
            start_source = 'volunteer_last_known'

        return (float(start_latitude), float(start_longitude), start_source)

    def _resolve_donation_candidates(self, donation_ids):
        donations = list(
            DonationCard.objects.filter(id__in=donation_ids)
            .select_related('created_by', 'donor_organization')
            .prefetch_related('missions', 'suggestions')
        )
        found_ids = {item.id for item in donations}
        missing_ids = [str(item) for item in donation_ids if item not in found_ids]
        if missing_ids:
            raise ValidationError({'donation_ids': f'Invalid donation IDs: {", ".join(missing_ids)}'})

        candidates, skipped = build_routing_candidates(donations)
        return candidates, skipped

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        mission = request_volunteer(self.get_object(), request.user)
        return Response(MissionSerializer(mission).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve_request(self, request, pk=None):
        mission = approve_volunteer_request(self.get_object(), request.user)
        return Response(MissionSerializer(mission).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject_request(self, request, pk=None):
        mission = reject_volunteer_request(self.get_object(), request.user)
        return Response(MissionSerializer(mission).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def request_delivery(self, request, pk=None):
        mission = request_delivery_verification(self.get_object(), request.user)
        return Response(MissionSerializer(mission).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def approve_delivery(self, request, pk=None):
        mission = approve_delivery(self.get_object(), request.user)
        return Response(MissionSerializer(mission).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject_delivery(self, request, pk=None):
        mission = reject_delivery(self.get_object(), request.user)
        return Response(MissionSerializer(mission).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def scan_pickup(self, request, pk=None):
        mission = self.get_object()
        serializer = MissionActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = confirm_pickup_scan(mission, request.user, serializer.validated_data['qr_token'])
        return Response(MissionSerializer(updated).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def scan_delivery(self, request, pk=None):
        mission = self.get_object()
        serializer = MissionActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = confirm_delivery_scan(mission, request.user, serializer.validated_data['qr_token'])
        return Response(MissionSerializer(updated).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        mission = cancel_mission(self.get_object(), request.user)
        return Response(MissionSerializer(mission).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='optimized-route')
    def optimized_route(self, request):
        serializer = OptimizedRouteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        volunteer_id = data.get('volunteer_id') or request.user.id
        volunteer = User.objects.filter(id=volunteer_id, role=User.Role.VOLUNTEER).first()
        if not volunteer:
            raise ValidationError('Volunteer was not found or is not a volunteer account.')

        start_latitude, start_longitude, start_source = self._resolve_volunteer_start(
            volunteer,
            volunteer_address=data.get('volunteer_address'),
        )

        donation_ids = data['donation_ids']
        candidates, skipped = self._resolve_donation_candidates(donation_ids)
        if not candidates:
            return Response(
                {
                    'optimized_donation_order': [],
                    'route_steps': [],
                    'skipped_donations': skipped,
                    'message': 'No donations could be routed. Check addresses/coordinates.',
                },
                status=status.HTTP_200_OK,
            )

        ordered_ids, route_steps = optimize_pickup_route(start_latitude, start_longitude, candidates)
        logger.debug(
            'Optimized hunger-aware route volunteer=%s donations=%s ordered=%s skipped=%s',
            volunteer.id,
            [str(item) for item in donation_ids],
            ordered_ids,
            skipped,
        )
        return Response(
            {
                'volunteer_id': str(volunteer.id),
                'optimized_donation_order': ordered_ids,
                'route_steps': route_steps,
                'start_location': {
                    'latitude': round(start_latitude, 6),
                    'longitude': round(start_longitude, 6),
                    'source': start_source,
                },
                'skipped_donations': skipped,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='hunger-routing-advanced')
    def hunger_routing_advanced(self, request):
        serializer = AdvancedHungerRoutingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        volunteer_id = data.get('volunteer_id') or request.user.id
        volunteer = User.objects.filter(id=volunteer_id, role=User.Role.VOLUNTEER).first()
        if not volunteer:
            raise ValidationError('Volunteer was not found or is not a volunteer account.')

        start_latitude, start_longitude, start_source = self._resolve_volunteer_start(
            volunteer,
            volunteer_address=data.get('volunteer_address'),
        )
        start_coords = (start_latitude, start_longitude)

        candidates, skipped = self._resolve_donation_candidates(data['donation_ids'])
        if not candidates:
            return Response(
                {
                    'algorithm': data['algorithm'],
                    'routes': [],
                    'skipped_donations': skipped,
                    'message': 'No donations could be routed. Check addresses/coordinates.',
                },
                status=status.HTTP_200_OK,
            )

        algorithm = data['algorithm']
        routes = []

        try:
            if algorithm in ['astar', 'compare']:
                astar_order, _ = astar_route(start_coords, candidates)
                routes.append(serialize_route_result('astar', start_coords, candidates, astar_order))

            if algorithm in ['annealing', 'compare']:
                annealing_order, _, annealing_cost = simulated_annealing_route(start_coords, candidates)
                routes.append(
                    serialize_route_result(
                        'annealing',
                        start_coords,
                        candidates,
                        annealing_order,
                        objective_cost=annealing_cost,
                    )
                )

            if algorithm in ['pareto', 'compare']:
                pareto_frontier = pareto_routes(start_coords, candidates)
                for route in pareto_frontier:
                    routes.append(
                        serialize_route_result(
                            'pareto',
                            start_coords,
                            candidates,
                            route['order_indices'],
                        )
                    )
        except ValueError as exc:
            raise ValidationError({'algorithm': str(exc)}) from exc

        if not routes:
            raise ValidationError({'algorithm': 'No routing result was generated for the selected algorithm.'})

        # Keep response compact in compare mode.
        if algorithm == 'compare':
            routes.sort(key=lambda item: item['total_distance_km'])
            routes = routes[:5]

        return Response(
            {
                'algorithm': algorithm,
                'volunteer_id': str(volunteer.id),
                'start_location': {
                    'latitude': round(start_latitude, 6),
                    'longitude': round(start_longitude, 6),
                    'source': start_source,
                },
                'routes': routes,
                'skipped_donations': skipped,
            },
            status=status.HTTP_200_OK,
        )
