import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.common.models import TimestampedModel


class User(AbstractUser):
    class Role(models.TextChoices):
        DONOR = 'DONOR', 'Donor'
        VOLUNTEER = 'VOLUNTEER', 'Volunteer'
        RECEIVER = 'RECEIVER', 'Receiver'
        ADMIN = 'ADMIN', 'Admin'

    class ProfileVisibility(models.TextChoices):
        PUBLIC = 'PUBLIC', 'Public'
        PRIVATE = 'PRIVATE', 'Private'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=Role.choices)
    profile_visibility = models.CharField(
        max_length=20,
        choices=ProfileVisibility.choices,
        default=ProfileVisibility.PUBLIC,
    )
    phone_number = models.CharField(max_length=20, blank=True)
    whatsapp_opt_in = models.BooleanField(default=False)
    is_verified_actor = models.BooleanField(default=False)
    last_known_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_known_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    @property
    def public_display_name(self):
        if self.profile_visibility == self.ProfileVisibility.PRIVATE:
            return None
        if self.first_name:
            return self.first_name
        return self.username


class VolunteerProfile(TimestampedModel):
    class Availability(models.TextChoices):
        ONLINE = 'ONLINE', 'Online'
        BUSY = 'BUSY', 'Busy'
        OFFLINE = 'OFFLINE', 'Offline'

    class VehicleType(models.TextChoices):
        WALK = 'WALK', 'Walk'
        BIKE = 'BIKE', 'Bike'
        CAR = 'CAR', 'Car'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='volunteer_profile')
    availability = models.CharField(max_length=20, choices=Availability.choices, default=Availability.OFFLINE)
    vehicle_type = models.CharField(max_length=20, choices=VehicleType.choices, default=VehicleType.BIKE)
    karma_points = models.IntegerField(default=0)

    def __str__(self):
        return f'{self.user.username} ({self.karma_points} pts)'


class ReceiverProfile(TimestampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='receiver_profile')
    household_size = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f'{self.user.username} (household: {self.household_size})'


class HungerScore(TimestampedModel):
    receiver_profile = models.OneToOneField(ReceiverProfile, on_delete=models.CASCADE, related_name='hunger_score')
    current_hunger_score = models.FloatField(default=0.0)
    hours_since_last_delivery = models.FloatField(default=0.0)
    household_size = models.PositiveIntegerField(default=1)
    last_calculated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-current_hunger_score']

    def __str__(self):
        return f'{self.receiver_profile.user.username}: {self.current_hunger_score:.2f}'
