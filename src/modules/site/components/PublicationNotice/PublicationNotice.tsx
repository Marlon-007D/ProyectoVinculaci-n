import { useEffect } from 'react';
import type { PublicationUpdates } from '../../types/publicationUpdates';
import { notify, type Notifier } from '../../../../shared/components/Toaster/notify';

interface Props { institutionId: string; updates: PublicationUpdates; notifier?: Notifier }

/** Announces new published content; only the person's click reloads the page. */
export function PublicationNotice({ institutionId, updates, notifier = notify }: Props) {
  useEffect(() => {
    const id = `publication:${institutionId}`;
    const stop = updates.subscribe(institutionId, () => notifier.info('Hay contenido nuevo publicado', {
      id, persistent: true,
      description: 'Guarda primero lo que estés llenando y recarga cuando termines.',
      action: { label: 'Recargar página', onClick: () => window.location.reload() },
    }));
    return () => { stop(); notifier.dismiss(id); };
  }, [institutionId, updates, notifier]);
  return null;
}
