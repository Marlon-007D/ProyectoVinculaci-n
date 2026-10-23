export type AuthFormState =
  | { status: 'idle' }
  | { status: 'pending'; method: 'google' | 'credentials' }
  | { status: 'error'; message: string }
  | { status: 'registered'; message: string };

export type AuthFormEvent =
  | { type: 'start'; method: 'google' | 'credentials' }
  | { type: 'failed'; message: string }
  | { type: 'authenticated' }
  | { type: 'registered'; message: string };

export function authFormReducer(state: AuthFormState, event: AuthFormEvent): AuthFormState {
  switch (state.status) {
    case 'idle':
    case 'error':
      return event.type === 'start' ? { status: 'pending', method: event.method } : state;
    case 'registered':
      return state;
    case 'pending':
      switch (event.type) {
        case 'start': return state;
        case 'failed': return { status: 'error', message: event.message };
        case 'authenticated': return state.method === 'credentials' ? { status: 'idle' } : state;
        case 'registered': return state.method === 'credentials' ? { status: 'registered', message: event.message } : state;
        default: {
          const exhaustive: never = event;
          return exhaustive;
        }
      }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
