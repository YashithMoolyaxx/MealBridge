import uuid
from django.conf import settings
from django.db import models
from apps.common.models import TimestampedModel


class Organization(TimestampedModel):
    class Kind(models.TextChoices):
        DONOR_BUSINESS = 'DONOR_BUSINESS', 'Donor Business'
        NGO = 'NGO', 'NGO'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=30, choices=Kind.choices)
    is_verified = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    contact_phone = models.CharField(max_length=20, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_organizations',
    )

    def __str__(self):
        return self.name


class OrganizationMember(TimestampedModel):
    class MemberRole(models.TextChoices):
        OWNER = 'OWNER', 'Owner'
        MANAGER = 'MANAGER', 'Manager'
        STAFF = 'STAFF', 'Staff'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='organization_memberships')
    role = models.CharField(max_length=20, choices=MemberRole.choices, default=MemberRole.STAFF)

    class Meta:
        unique_together = ('organization', 'user')