from rest_framework import mixins, viewsets

from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer


class OrganizationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        queryset = Organization.objects.all()
        kind = self.request.query_params.get('kind')
        verified = self.request.query_params.get('verified')
        mine = self.request.query_params.get('mine')

        if mine == 'true' and self.request.user and self.request.user.is_authenticated:
            queryset = queryset.filter(members__user=self.request.user)

        if kind:
            queryset = queryset.filter(kind=kind)
        if verified == 'true':
            queryset = queryset.filter(is_verified=True)
        elif verified == 'false':
            queryset = queryset.filter(is_verified=False)
        return queryset.distinct().order_by('name')
