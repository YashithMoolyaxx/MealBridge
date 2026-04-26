from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.missions.models import Mission, MissionEvent, MissionQRToken
from services.eta import estimate_eta_minutes
from services.notifications import create_in_app_notification, dispatch_mission_offer_notifications
from apps.organizations.models import OrganizationMember
from services.qr import generate_qr_token
from services.rewards import award_mission_karma


ALLOWED_TRANSITIONS = {
    Mission.State.CREATED: {Mission.State.REQUESTED, Mission.State.CANCELLED, Mission.State.EXPIRED},
    Mission.State.REQUESTED: {Mission.State.VOLUNTEER_ASSIGNED, Mission.State.CREATED, Mission.State.CANCELLED},
    Mission.State.VOLUNTEER_ASSIGNED: {
        Mission.State.PICKUP_IN_PROGRESS,
        Mission.State.DELIVERY_PENDING,
        Mission.State.CANCELLED,
        Mission.State.EXPIRED,
    },
    Mission.State.PICKUP_IN_PROGRESS: {Mission.State.ON_ROUTE, Mission.State.CANCELLED},
    Mission.State.ON_ROUTE: {Mission.State.DELIVERED, Mission.State.DELIVERY_PENDING, Mission.State.CANCELLED},
    Mission.State.DELIVERED: {Mission.State.COMPLETED},
    Mission.State.DELIVERY_PENDING: {Mission.State.COMPLETED, Mission.State.DELIVERY_REJECTED},
    Mission.State.DELIVERY_REJECTED: set(),
    Mission.State.COMPLETED: set(),
    Mission.State.CANCELLED: set(),
    Mission.State.EXPIRED: set(),
}


def append_event(mission, actor, event_type, message, metadata=None):
    MissionEvent.objects.create(
        mission=mission,
        actor=actor,
        event_type=event_type,
        message=message,
        metadata=metadata or {},
    )


def transition_mission(mission, to_state, actor, event_type, message, metadata=None):
    allowed = ALLOWED_TRANSITIONS.get(mission.state, set())
    if to_state not in allowed:
        raise ValidationError(f'Invalid transition from {mission.state} to {to_state}.')

    mission.state = to_state
    mission.save(update_fields=['state', 'updated_at'])
    append_event(mission, actor, event_type, message, metadata)


def create_pickup_qr(mission, actor):
    token = MissionQRToken.objects.create(
        mission=mission,
        qr_type=MissionQRToken.QRType.PICKUP,
        token=generate_qr_token('PICKUP'),
    )
    append_event(mission, actor, MissionEvent.EventType.PICKUP_QR_GENERATED, 'Pickup QR generated')
    return token


def create_delivery_qr(mission, actor):
    token = MissionQRToken.objects.create(
        mission=mission,
        qr_type=MissionQRToken.QRType.DELIVERY,
        token=generate_qr_token('DELIVERY'),
    )
    append_event(mission, actor, MissionEvent.EventType.DELIVERY_QR_GENERATED, 'Delivery QR generated')
    return token


def assign_volunteer(mission, volunteer):
    if volunteer.role != 'VOLUNTEER':
        raise ValidationError('Only volunteers can accept a mission.')

    with transaction.atomic():
        if mission.state != Mission.State.CREATED:
            raise ValidationError('Mission is no longer open for volunteer assignment.')

        mission.volunteer_user = volunteer
        mission.pickup_eta_minutes = estimate_eta_minutes(
            volunteer.last_known_latitude,
            volunteer.last_known_longitude,
            mission.pickup_latitude,
            mission.pickup_longitude,
        )
        mission.delivery_eta_minutes = estimate_eta_minutes(
            mission.pickup_latitude,
            mission.pickup_longitude,
            mission.delivery_latitude,
            mission.delivery_longitude,
        )
        mission.save(update_fields=['volunteer_user', 'pickup_eta_minutes', 'delivery_eta_minutes', 'updated_at'])

        transition_mission(
            mission,
            Mission.State.VOLUNTEER_ASSIGNED,
            volunteer,
            MissionEvent.EventType.VOLUNTEER_ASSIGNED,
            'Volunteer accepted mission',
        )
        create_pickup_qr(mission, volunteer)

        if mission.donor_user:
            contact = volunteer.phone_number or 'Not provided'
            create_in_app_notification(
                mission.donor_user,
                'Volunteer accepted mission',
                f'Volunteer {volunteer.username} (ID: {volunteer.id}) accepted the mission. Contact: {contact}.',
                mission=mission,
                payload={'volunteer_id': str(volunteer.id), 'volunteer_phone': contact},
            )

    return mission


def request_volunteer(mission, volunteer):
    if volunteer.role != 'VOLUNTEER':
        raise ValidationError('Only volunteers can request a mission.')

    with transaction.atomic():
        if mission.state != Mission.State.CREATED:
            raise ValidationError('Mission is no longer open for requests.')
        if mission.pending_volunteer_id:
            raise ValidationError('Another volunteer request is already pending.')

        mission.pending_volunteer = volunteer
        mission.save(update_fields=['pending_volunteer', 'updated_at'])
        transition_mission(
            mission,
            Mission.State.REQUESTED,
            volunteer,
            MissionEvent.EventType.VOLUNTEER_REQUESTED,
            'Volunteer requested mission',
        )

        if mission.donor_user:
            create_in_app_notification(
                mission.donor_user,
                'Volunteer request',
                f'{volunteer.username} wants to accept this mission.',
                mission=mission,
                payload={
                    'mission_id': str(mission.id),
                    'action': 'VOLUNTEER_REQUEST',
                    'volunteer_id': str(volunteer.id),
                    'volunteer_name': volunteer.username,
                },
            )

    return mission


def approve_volunteer_request(mission, actor):
    if actor.role != 'ADMIN' and mission.donor_user_id != actor.id:
        raise ValidationError('Only the donor can approve a volunteer request.')

    with transaction.atomic():
        if mission.state == Mission.State.VOLUNTEER_ASSIGNED and not mission.pending_volunteer_id:
            return mission
        if mission.state != Mission.State.REQUESTED or not mission.pending_volunteer_id:
            raise ValidationError('No pending volunteer request to approve.')

        volunteer = mission.pending_volunteer
        mission.pending_volunteer = None
        mission.volunteer_user = volunteer
        mission.pickup_eta_minutes = estimate_eta_minutes(
            volunteer.last_known_latitude,
            volunteer.last_known_longitude,
            mission.pickup_latitude,
            mission.pickup_longitude,
        )
        mission.delivery_eta_minutes = estimate_eta_minutes(
            mission.pickup_latitude,
            mission.pickup_longitude,
            mission.delivery_latitude,
            mission.delivery_longitude,
        )
        mission.save(update_fields=['pending_volunteer', 'volunteer_user', 'pickup_eta_minutes', 'delivery_eta_minutes', 'updated_at'])

        transition_mission(
            mission,
            Mission.State.VOLUNTEER_ASSIGNED,
            actor,
            MissionEvent.EventType.VOLUNTEER_ASSIGNED,
            'Donor approved volunteer request',
        )
        create_pickup_qr(mission, actor)

        if volunteer:
            create_in_app_notification(
                volunteer,
                'Request approved',
                'Your volunteer request was approved. Proceed to pickup.',
                mission=mission,
                payload={'mission_id': str(mission.id)},
            )

    return mission


def reject_volunteer_request(mission, actor):
    if actor.role != 'ADMIN' and mission.donor_user_id != actor.id:
        raise ValidationError('Only the donor can reject a volunteer request.')

    with transaction.atomic():
        if mission.state == Mission.State.CREATED and not mission.pending_volunteer_id:
            return mission
        if mission.state != Mission.State.REQUESTED or not mission.pending_volunteer_id:
            raise ValidationError('No pending volunteer request to reject.')

        volunteer = mission.pending_volunteer
        mission.pending_volunteer = None
        mission.save(update_fields=['pending_volunteer', 'updated_at'])

        transition_mission(
            mission,
            Mission.State.CREATED,
            actor,
            MissionEvent.EventType.VOLUNTEER_REJECTED,
            'Donor rejected volunteer request',
        )

        if volunteer:
            create_in_app_notification(
                volunteer,
                'Request rejected',
                'Your volunteer request was not approved. You can try another mission.',
                mission=mission,
                payload={'mission_id': str(mission.id)},
            )

    return mission


def request_delivery_verification(mission, actor):
    if actor.role != 'VOLUNTEER':
        raise ValidationError('Only volunteers can request delivery verification.')

    with transaction.atomic():
        if mission.state not in [Mission.State.ON_ROUTE, Mission.State.VOLUNTEER_ASSIGNED]:
            raise ValidationError('Delivery verification can be requested only after volunteer approval.')

        transition_mission(
            mission,
            Mission.State.DELIVERY_PENDING,
            actor,
            MissionEvent.EventType.DELIVERY_VERIFY_REQUESTED,
            'Volunteer requested delivery verification',
        )

        members = OrganizationMember.objects.filter(organization=mission.receiver_organization)
        for member in members:
            create_in_app_notification(
                member.user,
                'Verify delivery',
                f'Volunteer {actor.username} marked delivery ready. Please accept or reject.',
                mission=mission,
                payload={
                    'mission_id': str(mission.id),
                    'action': 'DELIVERY_VERIFY',
                    'volunteer_id': str(actor.id),
                    'volunteer_name': actor.username,
                },
            )

    return mission


def approve_delivery(mission, actor):
    is_member = OrganizationMember.objects.filter(organization=mission.receiver_organization, user=actor).exists()
    if actor.role != 'ADMIN' and not is_member:
        raise ValidationError('Only the receiving NGO can approve delivery.')

    with transaction.atomic():
        if mission.state != Mission.State.DELIVERY_PENDING:
            raise ValidationError('No delivery verification pending.')

        transition_mission(
            mission,
            Mission.State.COMPLETED,
            actor,
            MissionEvent.EventType.DELIVERY_CONFIRMED,
            'Receiver confirmed delivery',
        )

        if mission.volunteer_user:
            urgent = bool(mission.requirement_card and mission.requirement_card.urgency in ['HIGH', 'CRITICAL'])
            night = timezone.localtime(timezone.now()).hour >= 22 or timezone.localtime(timezone.now()).hour < 6
            award_mission_karma(mission.volunteer_user, mission, urgent=urgent, night=night)
            create_in_app_notification(
                mission.volunteer_user,
                'Delivery confirmed',
                'Receiver confirmed the delivery. Mission completed.',
                mission=mission,
                payload={'mission_id': str(mission.id)},
            )

        if mission.donor_user:
            create_in_app_notification(
                mission.donor_user,
                'Delivery confirmed',
                'Receiver confirmed delivery. Mission completed successfully.',
                mission=mission,
                payload={'mission_id': str(mission.id)},
            )

    return mission


def reject_delivery(mission, actor):
    is_member = OrganizationMember.objects.filter(organization=mission.receiver_organization, user=actor).exists()
    if actor.role != 'ADMIN' and not is_member:
        raise ValidationError('Only the receiving NGO can reject delivery.')

    with transaction.atomic():
        if mission.state != Mission.State.DELIVERY_PENDING:
            raise ValidationError('No delivery verification pending.')

        transition_mission(
            mission,
            Mission.State.DELIVERY_REJECTED,
            actor,
            MissionEvent.EventType.DELIVERY_REJECTED,
            'Receiver rejected delivery',
        )

        if mission.volunteer_user:
            create_in_app_notification(
                mission.volunteer_user,
                'Delivery rejected',
                'Receiver rejected the delivery. Please contact the donor.',
                mission=mission,
                payload={'mission_id': str(mission.id)},
            )

        if mission.donor_user:
            create_in_app_notification(
                mission.donor_user,
                'Delivery rejected',
                'Receiver rejected the delivery. Mission marked incomplete.',
                mission=mission,
                payload={'mission_id': str(mission.id)},
            )

    return mission


def _validate_qr(mission, token, qr_type):
    qr = MissionQRToken.objects.filter(mission=mission, token=token, qr_type=qr_type, is_active=True).first()
    if not qr:
        raise ValidationError('Invalid or expired QR token.')
    return qr


def confirm_pickup_scan(mission, actor, token):
    with transaction.atomic():
        if mission.state != Mission.State.VOLUNTEER_ASSIGNED:
            raise ValidationError('Pickup can be confirmed only after volunteer assignment.')

        qr = _validate_qr(mission, token, MissionQRToken.QRType.PICKUP)
        qr.is_active = False
        qr.scanned_by = actor
        qr.scanned_at = timezone.now()
        qr.save(update_fields=['is_active', 'scanned_by', 'scanned_at', 'updated_at'])

        transition_mission(
            mission,
            Mission.State.PICKUP_IN_PROGRESS,
            actor,
            MissionEvent.EventType.PICKUP_SCANNED,
            'Pickup QR scanned',
        )
        transition_mission(
            mission,
            Mission.State.ON_ROUTE,
            actor,
            MissionEvent.EventType.PICKUP_SCANNED,
            'Volunteer on route to receiver',
        )
        create_delivery_qr(mission, actor)

    return mission


def confirm_delivery_scan(mission, actor, token):
    with transaction.atomic():
        if mission.state != Mission.State.ON_ROUTE:
            raise ValidationError('Delivery can be confirmed only while mission is on route.')

        qr = _validate_qr(mission, token, MissionQRToken.QRType.DELIVERY)
        qr.is_active = False
        qr.scanned_by = actor
        qr.scanned_at = timezone.now()
        qr.save(update_fields=['is_active', 'scanned_by', 'scanned_at', 'updated_at'])

        transition_mission(
            mission,
            Mission.State.DELIVERED,
            actor,
            MissionEvent.EventType.DELIVERY_SCANNED,
            'Delivery QR scanned by receiver',
        )
        transition_mission(
            mission,
            Mission.State.COMPLETED,
            actor,
            MissionEvent.EventType.COMPLETED,
            'Mission completed',
        )

        if mission.volunteer_user:
            urgent = bool(mission.requirement_card and mission.requirement_card.urgency in ['HIGH', 'CRITICAL'])
            night = timezone.localtime(timezone.now()).hour >= 22 or timezone.localtime(timezone.now()).hour < 6
            award_mission_karma(mission.volunteer_user, mission, urgent=urgent, night=night)

    return mission


def cancel_mission(mission, actor):
    with transaction.atomic():
        if actor.role != 'ADMIN' and mission.donor_user != actor:
            raise ValidationError('Only the donor who created the mission can cancel it.')

        if mission.state in [Mission.State.COMPLETED, Mission.State.CANCELLED]:
            raise ValidationError('Mission cannot be cancelled from the current state.')

        transition_mission(
            mission,
            Mission.State.CANCELLED,
            actor,
            MissionEvent.EventType.CANCELLED,
            'Mission cancelled',
        )

        if mission.donation_card:
            mission.donation_card.soft_delete()

    return mission


def broadcast_mission(mission):
    dispatch_mission_offer_notifications(mission)


def initialize_mission(mission, actor):
    append_event(
        mission,
        actor,
        MissionEvent.EventType.CREATED,
        'Mission created',
        metadata={
            'donation_card_id': str(mission.donation_card_id) if mission.donation_card_id else None,
            'requirement_card_id': str(mission.requirement_card_id) if mission.requirement_card_id else None,
        },
    )
    broadcast_mission(mission)
