from rest_framework import serializers
from apps.impact.models import ImpactEntry


class ImpactEntrySerializer(serializers.ModelSerializer):
    donor_name = serializers.SerializerMethodField()
    volunteer_name = serializers.SerializerMethodField()
    receiver_name = serializers.CharField(source='mission.receiver_organization.name', read_only=True)

    class Meta:
        model = ImpactEntry
        fields = [
            'id',
            'mission',
            'beneficiary_count',
            'public_note',
            'photo_url',
            'donor_name',
            'volunteer_name',
            'receiver_name',
            'created_at',
        ]

    def _public_name(self, user, fallback):
        if not user:
            return fallback
        return user.public_display_name or fallback

    def get_donor_name(self, obj):
        return self._public_name(obj.mission.donor_user, 'Anonymous Donor')

    def get_volunteer_name(self, obj):
        return self._public_name(obj.mission.volunteer_user, 'Anonymous Volunteer')
