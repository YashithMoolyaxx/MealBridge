from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.requirements.models import RequirementCard
from apps.requirements.serializers import FulfillRequirementSerializer, RequirementCardSerializer
from apps.donations.models import DonationCard
from apps.missions.models import Mission
from apps.organizations.models import Organization, OrganizationMember
from services.mission_flow import initialize_mission


class RequirementCardViewSet(viewsets.ModelViewSet):
    serializer_class = RequirementCardSerializer

    def get_queryset(self):
        queryset = RequirementCard.objects.select_related('receiver_organization', 'created_by')
        if self.request.user.role == 'RECEIVER':
            return queryset.filter(receiver_organization__members__user=self.request.user)
        return queryset.filter(status=RequirementCard.CardStatus.ACTIVE)

    def perform_create(self, serializer):
        if self.request.user.role != 'RECEIVER':
            raise ValidationError('Only receiver NGO users can create requirement cards.')
        receiver_org = serializer.validated_data.get('receiver_organization')
        if receiver_org is None:
            receiver_org = (
                Organization.objects.filter(
                    kind=Organization.Kind.NGO,
                    members__user=self.request.user,
                )
                .order_by('created_at')
                .first()
            )
        if receiver_org is None:
            raise ValidationError('No NGO organization found for this account.')
        if receiver_org.kind != Organization.Kind.NGO:
            raise ValidationError('Selected organization must be an NGO.')
        is_member = OrganizationMember.objects.filter(organization=receiver_org, user=self.request.user).exists()
        if not is_member:
            raise ValidationError('You can only create requirements for organizations linked to your account.')

        requirement = serializer.save(created_by=self.request.user, receiver_organization=receiver_org)
        if receiver_org.address == 'Not set yet':
            receiver_org.address = requirement.location_address
            receiver_org.latitude = requirement.location_latitude
            receiver_org.longitude = requirement.location_longitude
            receiver_org.save(update_fields=['address', 'latitude', 'longitude', 'updated_at'])

    @action(detail=True, methods=['post'])
    def fulfill(self, request, pk=None):
        if request.user.role != 'DONOR':
            raise ValidationError('Only donor users can fulfill requirements.')
        requirement = self.get_object()
        serializer = FulfillRequirementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        donation = None
        if data.get('donation_card_id'):
            donation = DonationCard.objects.filter(id=data['donation_card_id'], created_by=request.user).first()

        with transaction.atomic():
            mission = Mission.objects.create(
                donation_card=donation,
                requirement_card=requirement,
                donor_user=request.user,
                receiver_organization=requirement.receiver_organization,
                pickup_address=data['pickup_address'],
                pickup_latitude=data['pickup_latitude'],
                pickup_longitude=data['pickup_longitude'],
                delivery_address=requirement.location_address,
                delivery_latitude=requirement.location_latitude,
                delivery_longitude=requirement.location_longitude,
                expires_at=requirement.required_before,
            )
            initialize_mission(mission, request.user)
            requirement.status = RequirementCard.CardStatus.FULFILLED
            requirement.save(update_fields=['status', 'updated_at'])
            if donation:
                donation.status = DonationCard.CardStatus.FULFILLED
                donation.save(update_fields=['status', 'updated_at'])

        return Response({'mission_id': mission.id}, status=status.HTTP_201_CREATED)
