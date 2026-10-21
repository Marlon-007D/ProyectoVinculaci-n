export interface RegistrationInstitution { institution_id: string; name: string }
export interface RegistrationInput { firstName: string; lastName: string; email: string; password: string; institutionId: string }
export interface RegistrationService {
  listInstitutions(): Promise<RegistrationInstitution[]>;
  register(input: RegistrationInput): Promise<void>;
}

export type RegistrationState =
  | { status: 'loading' }
  | { status: 'loadError'; message?: string }
  | { status: 'ready'; institutions: RegistrationInstitution[]; error?: string }
  | { status: 'submitting'; institutions: RegistrationInstitution[] }
  | { status: 'success' };
export type RegistrationEvent =
  | { type: 'loaded'; institutions: RegistrationInstitution[] }
  | { type: 'loadFailed'; message?: string }
  | { type: 'retry' }
  | { type: 'submit' }
  | { type: 'failed'; message: string }
  | { type: 'succeeded' };

export function registrationReducer(state: RegistrationState, event: RegistrationEvent): RegistrationState {
  switch (event.type) {
    case 'loaded': return state.status === 'loading' ? { status: 'ready', institutions: event.institutions } : state;
    case 'loadFailed': return state.status === 'loading' ? { status: 'loadError', message: event.message } : state;
    case 'retry': return state.status === 'loadError' ? { status: 'loading' } : state;
    case 'submit': return state.status === 'ready' && state.institutions.length > 0 ? { status: 'submitting', institutions: state.institutions } : state;
    case 'failed': return state.status === 'submitting' ? { status: 'ready', institutions: state.institutions, error: event.message } : state;
    case 'succeeded': return state.status === 'submitting' ? { status: 'success' } : state;
    default: { const exhaustive: never = event; return exhaustive; }
  }
}
