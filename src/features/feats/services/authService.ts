export interface FeatsAuthCredentials {
  email: string
  password: string
}

export interface FeatsAuthService {
  hasSession(): boolean
  signIn(credentials: FeatsAuthCredentials, remember: boolean): Promise<boolean>
  signOut(): void
}
