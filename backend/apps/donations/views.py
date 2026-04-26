from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.donations.models import DonationCard
from apps.donations.serializers import (
    CreateMissionFromDonationSerializer,
    DonationCardSerializer,
    DonationStatusUpdateSerializer,
)
from apps.missions.models import Mission
from apps.organizations.models import Organization
from apps.requirements.models import RequirementCard
from services.geo import suggest_nearby_ngos
from services.mission_flow import initialize_mission


class DonationCardViewSet(viewsets.ModelViewSet):
    serializer_class = DonationCardSerializer

    def get_queryset(self):
        queryset = DonationCard.objects.select_related('created_by', 'donor_organization').prefetch_related('suggestions__ngo')
        if self.request.user.role == 'DONOR':
            return queryset.filter(created_by=self.request.user)
        return queryset.filter(status=DonationCard.CardStatus.ACTIVE)

    def perform_create(self, serializer):
        if self.request.user.role != 'DONOR':
            raise ValidationError('Only donor accounts can create donation cards.')
        donor_organization = serializer.validated_data.get('donor_organization')
        if donor_organization is None:
            donor_organization = (
                Organization.objects.filter(
                    kind=Organization.Kind.DONOR_BUSINESS,
                    members__user=self.request.user,
                )
                .order_by('created_at')
                .first()
            )
        donation = serializer.save(created_by=self.request.user, donor_organization=donor_organization)
        if donor_organization and donor_organization.address == 'Not set yet':
            donor_organization.address = donation.pickup_address
            donor_organization.latitude = donation.pickup_latitude
            donor_organization.longitude = donation.pickup_longitude
            donor_organization.save(update_fields=['address', 'latitude', 'longitude', 'updated_at'])
        suggest_nearby_ngos(donation)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        donation = self.get_object()
        serializer = DonationStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        donation.status = serializer.validated_data['status']
        donation.save(update_fields=['status', 'updated_at'])
        return Response(DonationCardSerializer(donation).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def create_mission(self, request, pk=None):
        donation = self.get_object()
        if request.user.role not in ['DONOR', 'ADMIN']:
            raise ValidationError('Only donor users can create missions from donations.')
        if request.user.role == 'DONOR' and donation.created_by_id != request.user.id:
            raise ValidationError('You can only create missions from your own donations.')
        serializer = CreateMissionFromDonationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        receiver = Organization.objects.filter(
            id=data['receiver_organization_id'],
            kind=Organization.Kind.NGO,
        ).first()
        if not receiver:
            raise ValidationError('Receiver NGO is invalid.')

        requirement = None
        if data.get('requirement_card_id'):
            requirement = RequirementCard.objects.filter(id=data['requirement_card_id']).first()

        delivery_address = requirement.location_address if requirement else receiver.address
        delivery_latitude = requirement.location_latitude if requirement else receiver.latitude
        delivery_longitude = requirement.location_longitude if requirement else receiver.longitude

        with transaction.atomic():
            mission = Mission.objects.create(
                donation_card=donation,
                requirement_card=requirement,
                donor_user=request.user,
                receiver_organization=receiver,
                pickup_address=donation.pickup_address,
                pickup_latitude=donation.pickup_latitude,
                pickup_longitude=donation.pickup_longitude,
                delivery_address=delivery_address,
                delivery_latitude=delivery_latitude,
                delivery_longitude=delivery_longitude,
                expires_at=donation.expiry_time,
            )
            initialize_mission(mission, request.user)
            donation.status = DonationCard.CardStatus.FULFILLED
            donation.save(update_fields=['status', 'updated_at'])

        return Response({'mission_id': mission.id}, status=status.HTTP_201_CREATED)
