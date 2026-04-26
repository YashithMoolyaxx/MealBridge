from rest_framework import serializers
from apps.requirements.models import RequirementCard


class RequirementCardSerializer(serializers.ModelSerializer):
    receiver_name = serializers.CharField(source='receiver_organization.name', read_only=True)

    class Meta:
        model = RequirementCard
        fields = [
            'id',
            'created_by',
            'created_at',
            'updated_at',
            'status',
            'receiver_organization',
            'receiver_name',
            'need_title',
            'meals_needed',
            'urgency',
            'required_before',
            'location_address',
            'location_latitude',
            'location_longitude',
            'notes',
        ]
        read_only_fields = ['created_by', 'status']
        extra_kwargs = {
            'receiver_organization': {'required': False},
        }


class FulfillRequirementSerializer(serializers.Serializer):
    donation_card_id = serializers.UUIDField(required=False, allow_null=True)
    pickup_address = serializers.CharField(max_length=255)
    pickup_latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    pickup_longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
