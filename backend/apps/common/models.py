import uuid
from django.db import models
from django.utils import timezone


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    class CardStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        FULFILLED = 'FULFILLED', 'Fulfilled'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=20, choices=CardStatus.choices, default=CardStatus.ACTIVE)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def soft_delete(self, status=CardStatus.CANCELLED):
        self.status = status
        self.deleted_at = timezone.now()
        self.save(update_fields=['status', 'deleted_at', 'updated_at'])