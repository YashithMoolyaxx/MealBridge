from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from django.utils import timezone

from apps.organizations.models import Organization, OrganizationMember
from apps.rewards.models import VoucherCampaign, VoucherRedemption
from apps.rewards.serializers import VoucherCampaignSerializer, VoucherRedemptionSerializer
from services.rewards import create_redemption_code


class VoucherCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = VoucherCampaignSerializer

    def get_queryset(self):
        return VoucherCampaign.objects.select_related('donor_organization')

    def perform_create(self, serializer):
        if self.request.user.role != 'DONOR':
            raise ValidationError('Only donor users can create voucher campaigns.')
        donor_org = serializer.validated_data.get('donor_organization')
        if donor_org is None:
            donor_org = (
                Organization.objects.filter(
                    kind=Organization.Kind.DONOR_BUSINESS,
                    members__user=self.request.user,
                )
                .order_by('created_at')
                .first()
            )
        if donor_org is None:
            raise ValidationError('No donor organization found for this account.')
        if donor_org.kind != Organization.Kind.DONOR_BUSINESS:
            raise ValidationError('Selected organization must be a donor business.')
        is_member = OrganizationMember.objects.filter(organization=donor_org, user=self.request.user).exists()
        if not is_member:
            raise ValidationError('You can only create campaigns for organizations linked to your account.')
        serializer.save(donor_organization=donor_org)


class VoucherRedemptionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = VoucherRedemptionSerializer

    def get_queryset(self):
        return VoucherRedemption.objects.filter(redeemed_by=self.request.user).select_related('campaign')

    def create(self, request, *args, **kwargs):
        if request.user.role != 'VOLUNTEER':
            raise ValidationError('Only volunteers can redeem voucher rewards.')
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = serializer.validated_data['campaign']
        karma_points = getattr(getattr(request.user, 'volunteer_profile', None), 'karma_points', 0)
        now = timezone.now()

        if not campaign.is_active or campaign.starts_at > now or campaign.ends_at < now:
            raise ValidationError('This voucher campaign is not active right now.')
        if karma_points < campaign.required_karma:
            raise ValidationError(
                f'You need at least {campaign.required_karma} karma points to redeem this voucher.',
            )

        redemption = create_redemption_code(campaign=campaign, user=request.user)
        return Response(self.get_serializer(redemption).data, status=status.HTTP_201_CREATED)
