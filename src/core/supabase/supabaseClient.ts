import { AppError } from '../errors/AppError'
import { env } from '../config/env'

interface SupabaseRequestOptions extends RequestInit { body?: BodyInit | null }

export const supabaseClient = {
  get isConfigured() { return env.hasSupabaseConfig },
  async request<T>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
    if (!env.hasSupabaseConfig) throw new AppError('Supabase no está configurado.')
    const headers = new Headers(options.headers)
    headers.set('apikey', env.supabaseAnonKey)
    headers.set('Authorization', `Bearer ${env.supabaseAnonKey}`)
    const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, { ...options, headers })
    if (!response.ok) throw new AppError(`La solicitud a Supabase falló (${response.status}).`)
    return response.status === 204 ? undefined as T : await response.json() as T
  },
}
