import random
import string
from django.db import transaction
from django.db.models import Sum

from apps.accounts.models import VolunteerProfile
from apps.rewards.models import KarmaLedger, VoucherRedemption


def _generate_code(prefix='MBR'):
    tokens = [
        ''.join(random.choices(string.ascii_uppercase + string.digits, k=4)),
        ''.join(random.choices(string.ascii_uppercase + string.digits, k=4)),
    ]
    return f'{prefix}-{tokens[0]}-{tokens[1]}'


def award_mission_karma(volunteer, mission, urgent=False, night=False):
    entries = [(10, KarmaLedger.Reason.MISSION_COMPLETED)]
    if urgent:
        entries.append((15, KarmaLedger.Reason.URGENT_DELIVERY))
    if night:
        entries.append((20, KarmaLedger.Reason.NIGHT_DELIVERY))

    with transaction.atomic():
        for points, reason in entries:
            KarmaLedger.objects.create(volunteer=volunteer, mission=mission, points=points, reason=reason)

        total = KarmaLedger.objects.filter(volunteer=volunteer).aggregate(total=Sum('points')).get('total') or 0
        VolunteerProfile.objects.filter(user=volunteer).update(karma_points=total)


def create_redemption_code(campaign, user):
    existing = VoucherRedemption.objects.filter(campaign=campaign, redeemed_by=user).first()
    if existing:
        return existing

    code_prefix = ''.join(ch for ch in campaign.donor_organization.name.upper() if ch.isalnum())[:3] or 'MBR'
    code = _generate_code(prefix=code_prefix)

    while VoucherRedemption.objects.filter(code=code).exists():
        code = _generate_code(prefix=code_prefix)

    return VoucherRedemption.objects.create(campaign=campaign, redeemed_by=user, code=code)