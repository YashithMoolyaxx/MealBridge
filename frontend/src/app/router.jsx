import { Navigate, createBrowserRouter } from 'react-router-dom'

import AppShell from '../layouts/AppShell'
import AuthLayout from '../layouts/AuthLayout'
import LandingPage from '../pages/LandingPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import DonationFeedPage from '../pages/feed/DonationFeedPage'
import RequirementFeedPage from '../pages/feed/RequirementFeedPage'
import ImpactFeedPage from '../pages/feed/ImpactFeedPage'
import MissionDetailPage from '../pages/missions/MissionDetailPage'
import VolunteerMissionsPage from '../pages/missions/VolunteerMissionsPage'
import CreateDonationPage from '../pages/missions/CreateDonationPage'
import CreateRequirementPage from '../pages/missions/CreateRequirementPage'
import RedeemRewardsPage from '../pages/rewards/RedeemRewardsPage'
import BusinessVoucherPage from '../pages/rewards/BusinessVoucherPage'
import ProfilePage from '../pages/profile/ProfilePage'
import AccountSettingsPage from '../pages/profile/AccountSettingsPage'
import LeaderboardPage from '../pages/leaderboard/LeaderboardPage'
import { isAuthenticated } from '../hooks/useAuth'

function ProtectedApp() {
  if (!isAuthenticated()) {
    return <Navigate to="/auth/login" replace />
  }
  return <AppShell />
}

function PublicOnlyAuth() {
  if (isAuthenticated()) {
    return <Navigate to="/app/dashboard" replace />
  }
  return <AuthLayout />
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <LandingPage />,
    },
    {
      path: '/auth',
      element: <PublicOnlyAuth />,
      children: [
        { path: 'login', element: <LoginPage /> },
        { path: 'register', element: <RegisterPage /> },
      ],
    },
    {
      path: '/app',
      element: <ProtectedApp />,
      children: [
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'donations', element: <DonationFeedPage /> },
        { path: 'requirements', element: <RequirementFeedPage /> },
        { path: 'impact', element: <ImpactFeedPage /> },
        { path: 'missions/volunteer', element: <VolunteerMissionsPage /> },
        { path: 'missions/new-donation', element: <CreateDonationPage /> },
        { path: 'missions/new-requirement', element: <CreateRequirementPage /> },
        { path: 'missions/:missionId', element: <MissionDetailPage /> },
        { path: 'rewards/redeem', element: <RedeemRewardsPage /> },
        { path: 'rewards/vouchers', element: <BusinessVoucherPage /> },
        { path: 'leaderboard', element: <LeaderboardPage /> },
        { path: 'profile', element: <ProfilePage /> },
        { path: 'account', element: <AccountSettingsPage /> },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/" replace />,
    },
  ],
  {
    future: {
      v7_startTransition: true,
    },
  },
)

export default router
