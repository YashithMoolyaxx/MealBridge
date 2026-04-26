from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User, VolunteerProfile
from apps.organizations.models import Organization, OrganizationMember
from apps.donations.models import DonationCard
from apps.requirements.models import RequirementCard
from apps.missions.models import Mission, MissionEvent
from apps.impact.models import ImpactEntry


class Command(BaseCommand):
    help = 'Seed demo data for MealBridge'

    def handle(self, *args, **options):
        self.stdout.write('Seeding demo data...')

        donor, _ = User.objects.get_or_create(
            username='demo_donor',
            defaults={
                'email': 'donor@mealbridge.demo',
                'role': User.Role.DONOR,
                'profile_visibility': User.ProfileVisibility.PUBLIC,
            },
        )
        donor.set_password('DemoPass123!')
        donor.save()

        receiver, _ = User.objects.get_or_create(
            username='demo_receiver',
            defaults={
                'email': 'receiver@mealbridge.demo',
                'role': User.Role.RECEIVER,
                'profile_visibility': User.ProfileVisibility.PUBLIC,
            },
        )
        receiver.set_password('DemoPass123!')
        receiver.save()

        volunteer, _ = User.objects.get_or_create(
            username='demo_volunteer',
            defaults={
                'email': 'volunteer@mealbridge.demo',
                'role': User.Role.VOLUNTEER,
                'profile_visibility': User.ProfileVisibility.PUBLIC,
                'phone_number': '+911234567890',
                'whatsapp_opt_in': True,
                'last_known_latitude': 19.0760,
                'last_known_longitude': 72.8777,
            },
        )
        volunteer.set_password('DemoPass123!')
        volunteer.save()
        VolunteerProfile.objects.get_or_create(user=volunteer)

        donor_org, _ = Organization.objects.get_or_create(
            name='Demo Donor Hub',
            kind=Organization.Kind.DONOR_BUSINESS,
            defaults={
                'is_verified': True,
                'address': 'Bandra West, Mumbai',
                'latitude': 19.0596,
                'longitude': 72.8295,
                'contact_phone': '+911234567890',
            },
        )
        OrganizationMember.objects.get_or_create(organization=donor_org, user=donor, role=OrganizationMember.MemberRole.OWNER)

        ngo_org, _ = Organization.objects.get_or_create(
            name='Demo Hope Shelter',
            kind=Organization.Kind.NGO,
            defaults={
                'is_verified': True,
                'address': 'Andheri East, Mumbai',
                'latitude': 19.1136,
                'longitude': 72.8697,
                'contact_phone': '+911234567891',
            },
        )
        OrganizationMember.objects.get_or_create(organization=ngo_org, user=receiver, role=OrganizationMember.MemberRole.OWNER)

        donation, _ = DonationCard.objects.get_or_create(
            food_title='Fresh Veg Meals',
            created_by=donor,
            defaults={
                'donor_organization': donor_org,
                'food_quantity': 50,
                'quantity_unit': 'Meals',
                'food_category': DonationCard.Category.COOKED_MEALS,
                'expiry_time': timezone.now() + timezone.timedelta(hours=3),
                'pickup_address': 'Bandra West, Mumbai',
                'pickup_latitude': 19.0596,
                'pickup_longitude': 72.8295,
                'image_url': '',
                'notes': 'Packed meals ready for pickup.',
            },
        )

        requirement, _ = RequirementCard.objects.get_or_create(
            receiver_organization=ngo_org,
            created_by=receiver,
            defaults={
                'need_title': 'Dinner for 60',
                'meals_needed': 60,
                'urgency': RequirementCard.Urgency.HIGH,
                'required_before': timezone.now() + timezone.timedelta(hours=4),
                'location_address': 'Andheri East, Mumbai',
                'location_latitude': 19.1136,
                'location_longitude': 72.8697,
                'notes': 'Support tonight meal service.',
            },
        )

        mission, _ = Mission.objects.get_or_create(
            donation_card=donation,
            requirement_card=requirement,
            donor_user=donor,
            receiver_organization=ngo_org,
            defaults={
                'pickup_address': donation.pickup_address,
                'pickup_latitude': donation.pickup_latitude,
                'pickup_longitude': donation.pickup_longitude,
                'delivery_address': requirement.location_address,
                'delivery_latitude': requirement.location_latitude,
                'delivery_longitude': requirement.location_longitude,
                'expires_at': donation.expiry_time,
            },
        )
        if not MissionEvent.objects.filter(mission=mission).exists():
            MissionEvent.objects.create(
                mission=mission,
                actor=donor,
                event_type=MissionEvent.EventType.CREATED,
                message='Mission created (demo).',
            )

        completed_mission, _ = Mission.objects.get_or_create(
            donation_card=donation,
            donor_user=donor,
            receiver_organization=ngo_org,
            defaults={
                'state': Mission.State.COMPLETED,
                'pickup_address': donation.pickup_address,
                'pickup_latitude': donation.pickup_latitude,
                'pickup_longitude': donation.pickup_longitude,
                'delivery_address': requirement.location_address,
                'delivery_latitude': requirement.location_latitude,
                'delivery_longitude': requirement.location_longitude,
                'expires_at': donation.expiry_time,
                'volunteer_user': volunteer,
            },
        )
        ImpactEntry.objects.get_or_create(
            mission=completed_mission,
            defaults={
                'beneficiary_count': 60,
                'public_note': 'Demo impact entry.',
                'photo_url': '',
                'is_public': True,
            },
        )

        self.stdout.write(self.style.SUCCESS('Demo data seeded.'))
