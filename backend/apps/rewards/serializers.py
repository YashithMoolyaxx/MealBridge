from rest_framework import serializers
from django.utils import timezone
from apps.rewards.models import VoucherCampaign, VoucherRedemption


class VoucherCampaignSerializer(serializers.ModelSerializer):
    can_redeem = serializers.SerializerMethodField()
    user_karma_points = serializers.SerializerMethodField()

    class Meta:
        model = VoucherCampaign
        fields = [
            'id',
            'donor_organization',
            'title',
            'offer_text',
            'required_karma',
            'starts_at',
            'ends_at',
            'is_active',
            'created_at',
            'can_redeem',
            'user_karma_points',
        ]
        extra_kwargs = {
            'donor_organization': {'required': False},
        }

    def _get_user_karma(self):
        request = self.context.get('request')
        if not request or not request.user or request.user.is_anonymous:
            return 0
        profile = getattr(request.user, 'volunteer_profile', None)
        return profile.karma_points if profile else 0

    def get_user_karma_points(self, obj):
        return self._get_user_karma()

    def get_can_redeem(self, obj):
        now = timezone.now()
        karma = self._get_user_karma()
        within_window = obj.starts_at <= now <= obj.ends_at
        return karma >= obj.required_karma and obj.is_active and within_window


class VoucherRedemptionSerializer(serializers.ModelSerializer):
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)

    class Meta:
        model = VoucherRedemption
        fields = ['id', 'campaign', 'campaign_title', 'code', 'status', 'created_at', 'redeemed_at']
        read_only_fields = ['code', 'status', 'redeemed_at']
