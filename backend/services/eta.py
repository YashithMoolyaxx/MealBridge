import requests
from django.conf import settings


def estimate_eta_minutes(origin_lat, origin_lng, destination_lat, destination_lng):
    if not settings.GOOGLE_MAPS_API_KEY:
        return None

    url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
    params = {
        'origins': f'{origin_lat},{origin_lng}',
        'destinations': f'{destination_lat},{destination_lng}',
        'key': settings.GOOGLE_MAPS_API_KEY,
        'mode': 'driving',
    }

    try:
        response = requests.get(url, params=params, timeout=8)
        response.raise_for_status()
        payload = response.json()
        seconds = payload['rows'][0]['elements'][0]['duration']['value']
        return max(1, round(seconds / 60))
    except Exception:
        return None