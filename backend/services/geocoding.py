import logging
from decimal import Decimal
from typing import Tuple

from geopy.exc import GeocoderServiceError, GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim

from apps.missions.models import GeocodeCache


logger = logging.getLogger(__name__)

_in_memory_cache = {}
_geolocator = Nominatim(user_agent='mealbridge-routing')


class GeocodingError(Exception):
    pass


def normalize_address(address: str) -> str:
    return ' '.join((address or '').strip().lower().split())


def geocode_address(address: str) -> Tuple[float, float]:
    if not address or not address.strip():
        raise GeocodingError('Address is required for geocoding.')

    normalized = normalize_address(address)
    cached = _in_memory_cache.get(normalized)
    if cached:
        return cached

    db_cache = GeocodeCache.objects.filter(normalized_address=normalized).only('latitude', 'longitude').first()
    if db_cache:
        coords = (float(db_cache.latitude), float(db_cache.longitude))
        _in_memory_cache[normalized] = coords
        return coords

    try:
        location = _geolocator.geocode(address, timeout=8)
    except (GeocoderTimedOut, GeocoderUnavailable, GeocoderServiceError) as exc:
        logger.warning('Geocoding failed for address="%s": %s', address, exc)
        raise GeocodingError(f'Geocoding service failed: {exc}') from exc

    if not location:
        logger.info('Geocoding returned no result for address="%s"', address)
        raise GeocodingError('Address could not be geocoded.')

    latitude = round(float(location.latitude), 6)
    longitude = round(float(location.longitude), 6)

    GeocodeCache.objects.update_or_create(
        normalized_address=normalized,
        defaults={
            'original_address': address.strip(),
            'latitude': Decimal(str(latitude)),
            'longitude': Decimal(str(longitude)),
            'provider': 'nominatim',
        },
    )

    coords = (latitude, longitude)
    _in_memory_cache[normalized] = coords
    return coords
