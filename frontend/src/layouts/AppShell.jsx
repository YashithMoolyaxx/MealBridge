import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearAuthSession, getAccessToken, getDisplayName, getStoredUser, setStoredUser } from '../hooks/useAuth'
import { fetchCurrentUser } from '../services/authService'
import Logo from '../components/ui/Logo'

function getNavItems(role) {
  const common = [
    ['Dashboard', '/app/dashboard'],
    ['Donations', '/app/donations'],
    ['Requirements', '/app/requirements'],
    ['Missions', '/app/missions/volunteer'],
    ['Impact', '/app/impact'],
    ['Leaderboard', '/app/leaderboard'],
  ]
  if (role === 'DONOR') {
    return [...common, ['Vouchers', '/app/rewards/vouchers'], ['Profile', '/app/profile']]
  }
  if (role === 'VOLUNTEER') {
    return [...common, ['Rewards', '/app/rewards/redeem'], ['Profile', '/app/profile']]
  }
  return [...common, ['Profile', '/app/profile']]
}

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(() => getStoredUser())
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef(null)
  const displayName = getDisplayName(user)
  const navItems = getNavItems(user?.role)

  useEffect(() => {
    const accessToken = getAccessToken()
    if (!accessToken) return

    fetchCurrentUser()
      .then((me) => {
        setStoredUser(me)
        setUser(me)
      })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 401 || status === 403) {
          clearAuthSession()
          navigate('/auth/login')
        }
      })
  }, [location.pathname, navigate])

  useEffect(() => {
    setMobileNavOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const onLogout = () => {
    setMenuOpen(false)
    clearAuthSession()
    navigate('/auth/login')
  }

  return (
    <div className="animate-page-in min-h-screen bg-cloud text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <Logo className="mb-2" />
            <h1 className="text-lg font-bold">Welcome, {displayName}</h1>
            <p className="text-xs text-slate">{user?.role || 'Member'} dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink md:hidden"
            >
              Menu
            </button>
            <nav className="hidden gap-2 lg:flex">
              {navItems.map(([label, path]) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive ? 'bg-gradient-to-r from-accent to-ink text-white shadow-card' : 'text-slate hover:bg-cloud'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-slate hover:bg-cloud"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-ink text-xs font-bold text-white">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{displayName}</span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-60 rounded-soft border border-line bg-white p-2 shadow-panel">
                  <p className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate">Account</p>
                  <Link
                    to="/app/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-cloud"
                  >
                    My profile
                  </Link>
                  <Link
                    to="/app/account"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-cloud"
                  >
                    Account settings
                  </Link>
                  <button
                    onClick={onLogout}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-danger hover:bg-cloud"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {mobileNavOpen ? (
          <div className="border-t border-line/70 bg-white px-4 py-3 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map(([label, path]) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `rounded-soft px-3 py-2 text-center text-sm font-semibold ${
                      isActive ? 'bg-ink text-white' : 'bg-cloud text-slate'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
