import { AppError } from '../errors/AppError'
import { env } from '../config/env'

interface SupabaseRequestOptions extends RequestInit {
  body?: BodyInit | null
  accessToken?: string
}

export const supabaseClient = {
  get isConfigured() { return env.hasSupabaseConfig },
  async request<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
    if (!env.hasSupabaseConfig) throw new AppError('Supabase no está configurado.')
    const { accessToken, ...requestOptions } = options
    const headers = new Headers(requestOptions.headers)
    headers.set('apikey', env.supabaseAnonKey)
    headers.set('Authorization', `Bearer ${accessToken ?? env.supabaseAnonKey}`)
    const projectUrl = env.supabaseUrl.replace(/\/rest\/v1\/?$/u, '').replace(/\/+$/u, '')
    const response = await fetch(`${projectUrl}/rest/v1/${path}`, { ...requestOptions, headers })
    if (!response.ok) throw new AppError(`La solicitud a Supabase falló (${response.status}).`)
    return response.status === 204 ? undefined as T : await response.json() as T
  },
}
