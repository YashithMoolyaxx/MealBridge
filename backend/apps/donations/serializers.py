from rest_framework import serializers
from apps.donations.models import DonationCard, DonationSuggestion
from apps.organizations.models import Organization, OrganizationMember


class DonationSuggestionSerializer(serializers.ModelSerializer):
    ngo_name = serializers.CharField(source='ngo.name', read_only=True)

    class Meta:
        model = DonationSuggestion
        fields = ['id', 'ngo', 'ngo_name', 'distance_km']


class DonationCardSerializer(serializers.ModelSerializer):
    suggestions = DonationSuggestionSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    donor_organization_name = serializers.CharField(source='donor_organization.name', read_only=True)

    class Meta:
        model = DonationCard
        fields = [
            'id',
            'created_by',
            'created_at',
            'updated_at',
            'status',
            'donor_organization',
            'donor_organization_name',
            'food_title',
            'food_quantity',
            'quantity_unit',
            'food_category',
            'expiry_time',
            'pickup_address',
            'pickup_latitude',
            'pickup_longitude',
            'image_url',
            'notes',
            'created_by_name',
            'suggestions',
        ]
        read_only_fields = ['created_by', 'status']

    def validate_donor_organization(self, value):
        if value and value.kind != Organization.Kind.DONOR_BUSINESS:
            raise serializers.ValidationError('Only donor businesses can be linked to a donation card.')
        request = self.context.get('request')
        if value and request and request.user and request.user.is_authenticated:
            is_member = OrganizationMember.objects.filter(organization=value, user=request.user).exists()
            if not is_member:
                raise serializers.ValidationError('You can only use donor organizations linked to your account.')
        return value


class DonationStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[DonationCard.CardStatus.CANCELLED, DonationCard.CardStatus.FULFILLED])


class CreateMissionFromDonationSerializer(serializers.Serializer):
    receiver_organization_id = serializers.UUIDField()
    requirement_card_id = serializers.UUIDField(required=False, allow_null=True)
