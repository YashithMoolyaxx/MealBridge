import uuid
from django.conf import settings
from django.db import models
from apps.common.models import TimestampedModel
from apps.missions.models import Mission
from apps.organizations.models import Organization


class KarmaLedger(TimestampedModel):
    class Reason(models.TextChoices):
        MISSION_COMPLETED = 'MISSION_COMPLETED', 'Mission Completed'
        URGENT_DELIVERY = 'URGENT_DELIVERY', 'Urgent Delivery'
        NIGHT_DELIVERY = 'NIGHT_DELIVERY', 'Night Delivery'
        ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT', 'Admin Adjustment'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    volunteer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='karma_entries')
    mission = models.ForeignKey(Mission, on_delete=models.SET_NULL, null=True, blank=True)
    points = models.IntegerField()
    reason = models.CharField(max_length=40, choices=Reason.choices)
    note = models.CharField(max_length=255, blank=True)


class VoucherCampaign(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    donor_organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='voucher_campaigns')
    title = models.CharField(max_length=120)
    offer_text = models.CharField(max_length=255)
    required_karma = models.PositiveIntegerField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)


class VoucherRedemption(TimestampedModel):
    class RedemptionStatus(models.TextChoices):
        GENERATED = 'GENERATED', 'Generated'
        USED = 'USED', 'Used'
        EXPIRED = 'EXPIRED', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    campaign = models.ForeignKey(VoucherCampaign, on_delete=models.CASCADE, related_name='redemptions')
    redeemed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='voucher_redemptions')
    code = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=20, choices=RedemptionStatus.choices, default=RedemptionStatus.GENERATED)
    redeemed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('campaign', 'redeemed_by')