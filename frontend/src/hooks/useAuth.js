const USER_KEY = 'mealbridge_user'
const ACCESS_KEY = 'mealbridge_access_token'
const REFRESH_KEY = 'mealbridge_refresh_token'
const TAB_KEY = 'mealbridge_tab_id'
const TAB_REGISTRY_KEY = 'mealbridge_tab_registry'
let tabInitialized = false

function safeParse(json) {
  try {
    return JSON.parse(json || '{}')
  } catch (error) {
    return {}
  }
}

function generateTabId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function initAuthTab() {
  if (tabInitialized || typeof window === 'undefined') return
  tabInitialized = true
  const session = window.sessionStorage
  const local = window.localStorage
  if (!session || !local) return

  let tabId = session.getItem(TAB_KEY)
  const registry = safeParse(local.getItem(TAB_REGISTRY_KEY))

  if (tabId && registry[tabId]) {
    tabId = generateTabId()
    session.setItem(TAB_KEY, tabId)
    session.removeItem(USER_KEY)
    session.removeItem(ACCESS_KEY)
    session.removeItem(REFRESH_KEY)
  } else if (!tabId) {
    tabId = generateTabId()
    session.setItem(TAB_KEY, tabId)
  }

  registry[tabId] = Date.now()
  local.setItem(TAB_REGISTRY_KEY, JSON.stringify(registry))

  window.addEventListener('beforeunload', () => {
    const latest = safeParse(local.getItem(TAB_REGISTRY_KEY))
    delete latest[tabId]
    local.setItem(TAB_REGISTRY_KEY, JSON.stringify(latest))
  })
}

function getSessionStorage() {
  if (typeof window === 'undefined') return null
  initAuthTab()
  return window.sessionStorage
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function migrateLegacyLocalStorageToSession() {
  const session = getSessionStorage()
  const local = getLocalStorage()
  if (!session || !local) return
  if (session.getItem(ACCESS_KEY)) return

  const access = local.getItem(ACCESS_KEY)
  const refresh = local.getItem(REFRESH_KEY)
  const user = local.getItem(USER_KEY)
  if (!access && !refresh && !user) return

  if (access) session.setItem(ACCESS_KEY, access)
  if (refresh) session.setItem(REFRESH_KEY, refresh)
  if (user) session.setItem(USER_KEY, user)

  local.removeItem(ACCESS_KEY)
  local.removeItem(REFRESH_KEY)
  local.removeItem(USER_KEY)
}

export function getStoredUser() {
  migrateLegacyLocalStorageToSession()
  const session = getSessionStorage()
  if (!session) return null
  try {
    return JSON.parse(session.getItem(USER_KEY) || 'null')
  } catch (error) {
    return null
  }
}

export function saveAuthSession(user, accessToken, refreshToken) {
  const session = getSessionStorage()
  if (!session) return
  session.setItem(USER_KEY, JSON.stringify(user))
  session.setItem(ACCESS_KEY, accessToken)
  session.setItem(REFRESH_KEY, refreshToken)
}

export function clearAuthSession() {
  const session = getSessionStorage()
  if (!session) return
  session.removeItem(USER_KEY)
  session.removeItem(ACCESS_KEY)
  session.removeItem(REFRESH_KEY)
}

export function getAccessToken() {
  migrateLegacyLocalStorageToSession()
  const session = getSessionStorage()
  if (!session) return null
  return session.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  migrateLegacyLocalStorageToSession()
  const session = getSessionStorage()
  if (!session) return null
  return session.getItem(REFRESH_KEY)
}

export function setAccessToken(token) {
  const session = getSessionStorage()
  if (!session) return
  session.setItem(ACCESS_KEY, token)
}

export function setStoredUser(user) {
  const session = getSessionStorage()
  if (!session) return
  session.setItem(USER_KEY, JSON.stringify(user))
}

export function isAuthenticated() {
  return Boolean(getAccessToken())
}

export function getDisplayName(user) {
  if (!user) return 'Guest'
  if (user.first_name) return user.first_name
  return user.username || 'User'
}
