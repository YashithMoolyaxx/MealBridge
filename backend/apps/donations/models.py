import uuid
from django.conf import settings
from django.db import models
from apps.common.models import SoftDeleteModel, TimestampedModel
from apps.organizations.models import Organization


class DonationCard(SoftDeleteModel, TimestampedModel):
    class Category(models.TextChoices):
        COOKED_MEALS = 'COOKED_MEALS', 'Cooked Meals'
        DRY_RATIONS = 'DRY_RATIONS', 'Dry Rations'
        BAKERY = 'BAKERY', 'Bakery'
        PRODUCE = 'PRODUCE', 'Produce'
        OTHER = 'OTHER', 'Other'

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='donation_cards')
    donor_organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='donation_cards',
    )
    food_title = models.CharField(max_length=120)
    food_quantity = models.PositiveIntegerField()
    quantity_unit = models.CharField(max_length=30, default='Meals')
    food_category = models.CharField(max_length=30, choices=Category.choices)
    expiry_time = models.DateTimeField()
    pickup_address = models.CharField(max_length=255)
    pickup_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    image_url = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f'{self.food_title} ({self.food_quantity})'


class DonationSuggestion(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    donation = models.ForeignKey(DonationCard, on_delete=models.CASCADE, related_name='suggestions')
    ngo = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='donation_suggestions')
    distance_km = models.DecimalField(max_digits=6, decimal_places=2)

    class Meta:
        unique_together = ('donation', 'ngo')
        ordering = ['distance_km']
