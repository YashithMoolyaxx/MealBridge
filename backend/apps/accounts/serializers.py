from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from apps.accounts.models import HungerScore, ReceiverProfile, User, VolunteerProfile
from apps.organizations.models import Organization, OrganizationMember


def ensure_default_role_organization(user):
    if user.role == User.Role.DONOR:
        has_org = OrganizationMember.objects.filter(user=user, organization__kind=Organization.Kind.DONOR_BUSINESS).exists()
        if not has_org:
            organization = Organization.objects.create(
                name=f'{user.username} Donor Hub',
                kind=Organization.Kind.DONOR_BUSINESS,
                is_verified=False,
                address='Not set yet',
                latitude=0,
                longitude=0,
            )
            OrganizationMember.objects.create(
                organization=organization,
                user=user,
                role=OrganizationMember.MemberRole.OWNER,
            )
    elif user.role == User.Role.RECEIVER:
        has_org = OrganizationMember.objects.filter(user=user, organization__kind=Organization.Kind.NGO).exists()
        if not has_org:
            organization = Organization.objects.create(
                name=f'{user.username} NGO',
                kind=Organization.Kind.NGO,
                is_verified=False,
                address='Not set yet',
                latitude=0,
                longitude=0,
            )
            OrganizationMember.objects.create(
                organization=organization,
                user=user,
                role=OrganizationMember.MemberRole.OWNER,
            )
        receiver_profile, _ = ReceiverProfile.objects.get_or_create(user=user)
        HungerScore.objects.get_or_create(
            receiver_profile=receiver_profile,
            defaults={'household_size': receiver_profile.household_size},
        )


class UserSerializer(serializers.ModelSerializer):
    karma_points = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'role',
            'profile_visibility',
            'phone_number',
            'whatsapp_opt_in',
            'is_verified_actor',
            'karma_points',
        ]

    def get_karma_points(self, obj):
        profile = getattr(obj, 'volunteer_profile', None)
        return profile.karma_points if profile else 0


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'phone_number', 'profile_visibility']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if user.role == User.Role.VOLUNTEER:
            VolunteerProfile.objects.create(user=user)
        ensure_default_role_organization(user)
        return user


class MealBridgeTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        if username and '@' in username:
            user = get_user_model().objects.filter(email__iexact=username).first()
            if user:
                attrs[self.username_field] = user.get_username()
        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone_number', 'whatsapp_opt_in', 'profile_visibility']


class LeaderboardEntrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    username = serializers.CharField()
    role = serializers.CharField()
    karma_points = serializers.IntegerField()
    completed_missions = serializers.IntegerField()
    meals_rescued = serializers.IntegerField()
