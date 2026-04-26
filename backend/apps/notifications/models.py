import uuid
from django.conf import settings
from django.db import models
from apps.common.models import TimestampedModel
from apps.missions.models import Mission


class Notification(TimestampedModel):
    class Channel(models.TextChoices):
        IN_APP = 'IN_APP', 'In App'
        WHATSAPP = 'WHATSAPP', 'WhatsApp'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    channel = models.CharField(max_length=20, choices=Channel.choices)
    title = models.CharField(max_length=120)
    body = models.TextField()
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']