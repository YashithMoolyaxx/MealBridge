import uuid
from django.conf import settings
from django.db import models
from apps.common.models import TimestampedModel
from apps.donations.models import DonationCard
from apps.organizations.models import Organization
from apps.requirements.models import RequirementCard


class Mission(TimestampedModel):
    class State(models.TextChoices):
        CREATED = 'CREATED', 'Created'
        REQUESTED = 'REQUESTED', 'Volunteer Requested'
        VOLUNTEER_ASSIGNED = 'VOLUNTEER_ASSIGNED', 'Volunteer Assigned'
        PICKUP_IN_PROGRESS = 'PICKUP_IN_PROGRESS', 'Pickup In Progress'
        ON_ROUTE = 'ON_ROUTE', 'On Route'
        DELIVERED = 'DELIVERED', 'Delivered'
        DELIVERY_PENDING = 'DELIVERY_PENDING', 'Delivery Pending'
        DELIVERY_REJECTED = 'DELIVERY_REJECTED', 'Delivery Rejected'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    donation_card = models.ForeignKey(DonationCard, on_delete=models.SET_NULL, null=True, blank=True, related_name='missions')
    requirement_card = models.ForeignKey(RequirementCard, on_delete=models.SET_NULL, null=True, blank=True, related_name='missions')
    donor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='donor_missions',
    )
    receiver_organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='receiver_missions')
    volunteer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='volunteer_missions',
    )
    pending_volunteer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pending_missions',
    )
    state = models.CharField(max_length=30, choices=State.choices, default=State.CREATED)
    pickup_address = models.CharField(max_length=255)
    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    delivery_address = models.CharField(max_length=255)
    delivery_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    delivery_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_eta_minutes = models.PositiveIntegerField(null=True, blank=True)
    delivery_eta_minutes = models.PositiveIntegerField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['state']),
            models.Index(fields=['created_at']),
        ]


class MissionEvent(TimestampedModel):
    class EventType(models.TextChoices):
        CREATED = 'CREATED', 'Created'
        NGO_SELECTED = 'NGO_SELECTED', 'NGO Selected'
        VOLUNTEER_REQUESTED = 'VOLUNTEER_REQUESTED', 'Volunteer Requested'
        VOLUNTEER_REJECTED = 'VOLUNTEER_REJECTED', 'Volunteer Rejected'
        VOLUNTEER_ASSIGNED = 'VOLUNTEER_ASSIGNED', 'Volunteer Assigned'
        PICKUP_QR_GENERATED = 'PICKUP_QR_GENERATED', 'Pickup QR Generated'
        PICKUP_SCANNED = 'PICKUP_SCANNED', 'Pickup Scanned'
        DELIVERY_VERIFY_REQUESTED = 'DELIVERY_VERIFY_REQUESTED', 'Delivery Verification Requested'
        DELIVERY_REJECTED = 'DELIVERY_REJECTED', 'Delivery Rejected'
        DELIVERY_CONFIRMED = 'DELIVERY_CONFIRMED', 'Delivery Confirmed'
        DELIVERY_QR_GENERATED = 'DELIVERY_QR_GENERATED', 'Delivery QR Generated'
        DELIVERY_SCANNED = 'DELIVERY_SCANNED', 'Delivery Scanned'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    message = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['created_at']


class MissionQRToken(TimestampedModel):
    class QRType(models.TextChoices):
        PICKUP = 'PICKUP', 'Pickup'
        DELIVERY = 'DELIVERY', 'Delivery'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name='qr_tokens')
    qr_type = models.CharField(max_length=20, choices=QRType.choices)
    token = models.CharField(max_length=128, unique=True)
    is_active = models.BooleanField(default=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scanned_qr_tokens',
    )

    class Meta:
        unique_together = ('mission', 'qr_type', 'is_active')


class GeocodeCache(TimestampedModel):
    normalized_address = models.CharField(max_length=255, unique=True)
    original_address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    provider = models.CharField(max_length=50, default='nominatim')

    class Meta:
        indexes = [
            models.Index(fields=['normalized_address']),
        ]

    def __str__(self):
        return f'{self.original_address} -> ({self.latitude}, {self.longitude})'
