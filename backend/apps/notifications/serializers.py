from rest_framework import serializers
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'channel', 'title', 'body', 'payload', 'status', 'created_at', 'sent_at']