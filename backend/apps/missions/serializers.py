from rest_framework import serializers
from apps.missions.models import Mission, MissionEvent, MissionQRToken
from apps.organizations.models import OrganizationMember


class MissionEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = MissionEvent
        fields = ['id', 'event_type', 'message', 'actor_name', 'metadata', 'created_at']


class MissionQRTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = MissionQRToken
        fields = ['id', 'qr_type', 'token', 'is_active', 'scanned_at']


class MissionSerializer(serializers.ModelSerializer):
    events = MissionEventSerializer(many=True, read_only=True)
    qr_tokens = serializers.SerializerMethodField()
    receiver_name = serializers.CharField(source='receiver_organization.name', read_only=True)
    donor_name = serializers.CharField(source='donor_user.username', read_only=True)
    volunteer_name = serializers.CharField(source='volunteer_user.username', read_only=True)
    pending_volunteer_name = serializers.CharField(source='pending_volunteer.username', read_only=True)
    donation_food_title = serializers.CharField(source='donation_card.food_title', read_only=True)
    donation_food_quantity = serializers.IntegerField(source='donation_card.food_quantity', read_only=True)
    donation_quantity_unit = serializers.CharField(source='donation_card.quantity_unit', read_only=True)
    donation_image_url = serializers.CharField(source='donation_card.image_url', read_only=True)
    donation_expiry_time = serializers.DateTimeField(source='donation_card.expiry_time', read_only=True)
    donation_notes = serializers.CharField(source='donation_card.notes', read_only=True)
    requirement_need_title = serializers.CharField(source='requirement_card.need_title', read_only=True)
    requirement_urgency = serializers.CharField(source='requirement_card.urgency', read_only=True)
    requirement_notes = serializers.CharField(source='requirement_card.notes', read_only=True)

    class Meta:
        model = Mission
        fields = [
            'id',
            'donation_card',
            'requirement_card',
            'donor_user',
            'receiver_organization',
            'volunteer_user',
            'pending_volunteer',
            'state',
            'pickup_address',
            'pickup_latitude',
            'pickup_longitude',
            'delivery_address',
            'delivery_latitude',
            'delivery_longitude',
            'pickup_eta_minutes',
            'delivery_eta_minutes',
            'expires_at',
            'created_at',
            'updated_at',
            'receiver_name',
            'donor_name',
            'volunteer_name',
            'pending_volunteer_name',
            'donation_food_title',
            'donation_food_quantity',
            'donation_quantity_unit',
            'donation_image_url',
            'donation_expiry_time',
            'donation_notes',
            'requirement_need_title',
            'requirement_urgency',
            'requirement_notes',
            'events',
            'qr_tokens',
        ]
        read_only_fields = ['state', 'volunteer_user']

    def get_qr_tokens(self, obj):
        request = self.context.get('request')
        if not request or request.user.is_anonymous:
            return []
        user = request.user

        tokens = []
        if user == obj.donor_user:
            tokens = obj.qr_tokens.filter(qr_type=MissionQRToken.QRType.PICKUP, is_active=True)
        elif user.role == 'RECEIVER':
            is_member = OrganizationMember.objects.filter(organization=obj.receiver_organization, user=user).exists()
            if is_member:
                tokens = obj.qr_tokens.filter(qr_type=MissionQRToken.QRType.DELIVERY, is_active=True)

        return MissionQRTokenSerializer(tokens, many=True).data


class MissionActionSerializer(serializers.Serializer):
    qr_token = serializers.CharField(required=False)


class OptimizedRouteRequestSerializer(serializers.Serializer):
    volunteer_id = serializers.UUIDField(required=False)
    donation_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text='Donation IDs to optimize in pickup order.',
    )
    volunteer_address = serializers.CharField(required=False, allow_blank=False)


class AdvancedHungerRoutingSerializer(serializers.Serializer):
    volunteer_id = serializers.UUIDField(required=False)
    donation_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        help_text='Donation IDs for route optimization.',
    )
    algorithm = serializers.ChoiceField(
        choices=['astar', 'pareto', 'annealing', 'compare'],
        default='compare',
    )
    volunteer_address = serializers.CharField(required=False, allow_blank=False)
