from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import AuthViewSet
from apps.donations.views import DonationCardViewSet
from apps.requirements.views import RequirementCardViewSet
from apps.missions.views import MissionViewSet
from apps.notifications.views import NotificationViewSet
from apps.rewards.views import VoucherCampaignViewSet, VoucherRedemptionViewSet
from apps.impact.views import ImpactFeedView
from apps.organizations.views import OrganizationViewSet

router = DefaultRouter()
router.register('auth', AuthViewSet, basename='auth')
router.register('donations', DonationCardViewSet, basename='donations')
router.register('requirements', RequirementCardViewSet, basename='requirements')
router.register('missions', MissionViewSet, basename='missions')
router.register('notifications', NotificationViewSet, basename='notifications')
router.register('vouchers/campaigns', VoucherCampaignViewSet, basename='voucher-campaigns')
router.register('vouchers/redemptions', VoucherRedemptionViewSet, basename='voucher-redemptions')
router.register('organizations', OrganizationViewSet, basename='organizations')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/v1/', include(router.urls)),
    path('api/v1/impact-feed/', ImpactFeedView.as_view(), name='impact-feed'),
]
