from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum

from apps.accounts.models import User
from apps.accounts.serializers import (
    MealBridgeTokenSerializer,
    LeaderboardEntrySerializer,
    RegisterSerializer,
    UserProfileUpdateSerializer,
    UserSerializer,
    ensure_default_role_organization,
)
from apps.missions.models import Mission
from apps.organizations.models import OrganizationMember


class AuthViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = User.objects.none()

    def get_permissions(self):
        if self.request.method.upper() == 'OPTIONS':
            return [AllowAny()]
        if self.action in ['register', 'login']:
            return [AllowAny()]
        if self.action == 'me':
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        serializer = MealBridgeTokenSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        if getattr(serializer, 'user', None):
            ensure_default_role_organization(serializer.user)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        ensure_default_role_organization(request.user)
        if request.method.lower() == 'patch':
            serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(UserSerializer(request.user).data)
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def stats(self, request):
        user = request.user
        if user.role == User.Role.DONOR:
            missions = Mission.objects.filter(donor_user=user, state=Mission.State.COMPLETED)
        elif user.role == User.Role.VOLUNTEER:
            missions = Mission.objects.filter(volunteer_user=user, state=Mission.State.COMPLETED)
        else:
            missions = Mission.objects.filter(
                receiver_organization__members__user=user,
                state=Mission.State.COMPLETED,
            )

        completed = missions.count()
        meals = missions.aggregate(total=Sum('donation_card__food_quantity'))['total'] or 0
        karma_points = 0
        if user.role == User.Role.VOLUNTEER:
            profile = getattr(user, 'volunteer_profile', None)
            karma_points = profile.karma_points if profile else 0
        else:
            karma_points = completed * 5

        last_completed = missions.order_by('-updated_at').values_list('updated_at', flat=True).first()

        return Response(
            {
                'completed_missions': completed,
                'meals_rescued': meals,
                'karma_points': karma_points,
                'last_completed_at': last_completed,
            }
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def leaderboard(self, request):
        role = request.query_params.get('role', User.Role.VOLUNTEER)
        users = User.objects.filter(role=role)
        entries = []

        for user in users:
            if role == User.Role.DONOR:
                missions = Mission.objects.filter(donor_user=user, state=Mission.State.COMPLETED)
            elif role == User.Role.VOLUNTEER:
                missions = Mission.objects.filter(volunteer_user=user, state=Mission.State.COMPLETED)
            else:
                missions = Mission.objects.filter(
                    receiver_organization__members__user=user,
                    state=Mission.State.COMPLETED,
                )

            completed = missions.count()
            meals = missions.aggregate(total=Sum('donation_card__food_quantity'))['total'] or 0
            karma_points = 0
            if role == User.Role.VOLUNTEER:
                profile = getattr(user, 'volunteer_profile', None)
                karma_points = profile.karma_points if profile else 0
            else:
                karma_points = completed * 5

            entries.append(
                {
                    'id': user.id,
                    'username': user.username,
                    'role': user.role,
                    'karma_points': int(karma_points),
                    'completed_missions': completed,
                    'meals_rescued': int(meals),
                }
            )

        entries.sort(key=lambda item: (item['karma_points'], item['meals_rescued']), reverse=True)
        serializer = LeaderboardEntrySerializer(entries, many=True)
        return Response(serializer.data)
