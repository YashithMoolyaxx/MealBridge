from django.utils import timezone

from apps.notifications.models import Notification


def create_in_app_notification(recipient, title, body, mission=None, payload=None):
    return Notification.objects.create(
        recipient=recipient,
        mission=mission,
        channel=Notification.Channel.IN_APP,
        title=title,
        body=body,
        payload=payload or {},
        status=Notification.Status.SENT,
        sent_at=timezone.now(),
    )


def dispatch_mission_offer_notifications(mission):
    from services.geo import volunteers_within_radius

    nearby, far = volunteers_within_radius(mission.pickup_latitude, mission.pickup_longitude)

    body = f'New mission: pickup at {mission.pickup_address} and deliver to {mission.delivery_address}.'
    payload = {'mission_id': str(mission.id), 'state': mission.state}

    for volunteer, distance in nearby:
        create_in_app_notification(volunteer, 'Nearby Mission', f'{body} ({distance} km away)', mission, payload)

    for volunteer, distance in far:
        distance_text = f'{distance} km away' if distance is not None else 'location not shared'
        create_in_app_notification(volunteer, 'New Mission Posted', f'{body} ({distance_text})', mission, payload)
