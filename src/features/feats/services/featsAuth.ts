import { demoAdminCredentials } from '../mocks/demoAdminCredentials'
import type { FeatsAuthCredentials, FeatsAuthService } from './authService'

const rememberedSessionKey = 'feats-demo-session'
const temporarySessionKey = 'feats-demo-session'

export const localDemoAuthService: FeatsAuthService = {
  hasSession: () => window.localStorage.getItem(rememberedSessionKey) === 'active'
    || window.sessionStorage.getItem(temporarySessionKey) === 'active',

  signIn: async ({ email, password }: FeatsAuthCredentials, remember) => {
    const validCredentials = email.trim().toLowerCase() === demoAdminCredentials.email
      && password === demoAdminCredentials.password
    if (!validCredentials) return false

    window.localStorage.removeItem(rememberedSessionKey)
    window.sessionStorage.removeItem(temporarySessionKey)
    const storage = remember ? window.localStorage : window.sessionStorage
    storage.setItem(remember ? rememberedSessionKey : temporarySessionKey, 'active')
    return true
  },

  signOut: () => {
    window.localStorage.removeItem(rememberedSessionKey)
    window.sessionStorage.removeItem(temporarySessionKey)
  },
}
