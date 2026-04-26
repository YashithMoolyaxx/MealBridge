import math
from decimal import Decimal

from apps.accounts.models import User
from apps.donations.models import DonationSuggestion
from apps.organizations.models import Organization


def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371
    dlat = math.radians(float(lat2) - float(lat1))
    dlon = math.radians(float(lon2) - float(lon1))
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(float(lat1)))
        * math.cos(math.radians(float(lat2)))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def suggest_nearby_ngos(donation, limit=5):
    ngos = Organization.objects.filter(kind=Organization.Kind.NGO, is_verified=True)
    if not ngos.exists():
        ngos = Organization.objects.filter(kind=Organization.Kind.NGO)
    suggestions = []

    for ngo in ngos:
        distance = haversine_km(
            donation.pickup_latitude,
            donation.pickup_longitude,
            ngo.latitude,
            ngo.longitude,
        )
        suggestions.append((ngo, Decimal(str(round(distance, 2)))))

    suggestions.sort(key=lambda item: item[1])

    DonationSuggestion.objects.filter(donation=donation).delete()
    for ngo, distance in suggestions[:limit]:
        DonationSuggestion.objects.create(donation=donation, ngo=ngo, distance_km=distance)


def volunteers_within_radius(latitude, longitude, radius_km=8):
    volunteers = User.objects.filter(
        role=User.Role.VOLUNTEER,
    ).select_related('volunteer_profile')

    nearby = []
    far = []

    for volunteer in volunteers:
        if volunteer.last_known_latitude is None or volunteer.last_known_longitude is None:
            far.append((volunteer, None))
            continue

        distance = haversine_km(latitude, longitude, volunteer.last_known_latitude, volunteer.last_known_longitude)
        if distance <= radius_km:
            nearby.append((volunteer, round(distance, 2)))
        else:
            far.append((volunteer, round(distance, 2)))

    return nearby, far
