from django.conf import settings
from django.db import models
from apps.common.models import SoftDeleteModel, TimestampedModel
from apps.organizations.models import Organization


class RequirementCard(SoftDeleteModel, TimestampedModel):
    class Urgency(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        CRITICAL = 'CRITICAL', 'Critical'

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='requirement_cards')
    receiver_organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name='requirements')
    need_title = models.CharField(max_length=120)
    meals_needed = models.PositiveIntegerField()
    urgency = models.CharField(max_length=20, choices=Urgency.choices)
    required_before = models.DateTimeField()
    location_address = models.CharField(max_length=255)
    location_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    location_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f'{self.receiver_organization.name}: {self.need_title}'