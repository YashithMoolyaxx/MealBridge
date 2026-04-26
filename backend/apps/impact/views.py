from rest_framework import generics
from rest_framework.permissions import AllowAny

from apps.impact.models import ImpactEntry
from apps.impact.serializers import ImpactEntrySerializer


class ImpactFeedView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ImpactEntrySerializer

    def get_queryset(self):
        return ImpactEntry.objects.filter(is_public=True, mission__state='COMPLETED').select_related(
            'mission__donor_user',
            'mission__volunteer_user',
            'mission__receiver_organization',
        )