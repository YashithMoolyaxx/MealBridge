import logging
from typing import Optional

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import HungerScore, ReceiverProfile
from apps.missions.models import Mission


logger = logging.getLogger(__name__)

MAX_WAIT_HOURS = 168.0


def calculate_hunger_score(hours_waiting: float, household_size: int) -> float:
    bounded_hours = max(0.0, min(float(hours_waiting), MAX_WAIT_HOURS))
    safe_household_size = max(1, int(household_size or 1))
    return float((bounded_hours ** 1.2) * (1 + safe_household_size / 10.0))


def _last_completed_delivery(receiver_profile: ReceiverProfile):
    return (
        Mission.objects.filter(
            state=Mission.State.COMPLETED,
            receiver_organization__members__user=receiver_profile.user,
        )
        .order_by('-updated_at')
        .first()
    )


def _hours_since_last_delivery(receiver_profile: ReceiverProfile, now):
    last_delivery = _last_completed_delivery(receiver_profile)
    start_time = last_delivery.updated_at if last_delivery else receiver_profile.created_at
    hours_waiting = (now - start_time).total_seconds() / 3600.0
    bounded_hours = max(0.0, min(hours_waiting, MAX_WAIT_HOURS))
    return bounded_hours, last_delivery


def update_receiver_hunger_score(receiver_profile: ReceiverProfile, now=None):
    now = now or timezone.now()

    with transaction.atomic():
        locked_profile = ReceiverProfile.objects.select_for_update().get(id=receiver_profile.id)
        hunger_score, _ = HungerScore.objects.select_for_update().get_or_create(
            receiver_profile=locked_profile,
            defaults={'household_size': locked_profile.household_size},
        )

        household_size = max(1, int(hunger_score.household_size or locked_profile.household_size or 1))
        hours_waiting, last_delivery = _hours_since_last_delivery(locked_profile, now)
        score = calculate_hunger_score(hours_waiting, household_size)

        hunger_score.hours_since_last_delivery = hours_waiting
        hunger_score.household_size = household_size
        hunger_score.current_hunger_score = score
        hunger_score.last_calculated_at = now
        hunger_score.save(
            update_fields=[
                'hours_since_last_delivery',
                'household_size',
                'current_hunger_score',
                'last_calculated_at',
                'updated_at',
            ]
        )

    logger.debug(
        'Updated hunger score receiver=%s hours=%.2f household=%s score=%.2f',
        locked_profile.user_id,
        hours_waiting,
        household_size,
        score,
    )
    return hunger_score, last_delivery


def update_all_hunger_scores(receiver_id: Optional[str] = None):
    queryset = ReceiverProfile.objects.select_related('user').all()
    if receiver_id:
        queryset = queryset.filter(user_id=receiver_id)

    now = timezone.now()
    updates = []
    for receiver_profile in queryset:
        hunger_score, last_delivery = update_receiver_hunger_score(receiver_profile, now=now)
        updates.append(
            {
                'receiver_user_id': str(receiver_profile.user_id),
                'receiver_username': receiver_profile.user.username,
                'score': round(hunger_score.current_hunger_score, 4),
                'hours_waiting': round(hunger_score.hours_since_last_delivery, 4),
                'last_delivery_at': last_delivery.updated_at if last_delivery else None,
            }
        )
    return updates
