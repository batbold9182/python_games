const ACCESS = 'access_token'
const REFRESH = 'refresh_token'

export const tokenStorage = {
  get(): { access: string | null; refresh: string | null } {
    try {
      return { access: localStorage.getItem(ACCESS), refresh: localStorage.getItem(REFRESH) }
    } catch {
      return { access: null, refresh: null }
    }
  },
  save(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS, access)
      localStorage.setItem(REFRESH, refresh)
    } catch {
      // storage blocked (private window etc.) — user just won't stay logged in across reloads
    }
  },
  saveAccess(access: string) {
    try {
      localStorage.setItem(ACCESS, access)
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS)
      localStorage.removeItem(REFRESH)
    } catch {
      // ignore
    }
  },
}
