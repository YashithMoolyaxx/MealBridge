import uuid
from django.db import models
from apps.common.models import TimestampedModel
from apps.missions.models import Mission


class ImpactEntry(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mission = models.OneToOneField(Mission, on_delete=models.CASCADE, related_name='impact_entry')
    beneficiary_count = models.PositiveIntegerField(default=0)
    public_note = models.CharField(max_length=255, blank=True)
    photo_url = models.URLField(blank=True)
    is_public = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']