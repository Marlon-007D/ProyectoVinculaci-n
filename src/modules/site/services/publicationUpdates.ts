import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicationUpdates } from '../types/publicationUpdates';

// Only a public revision counter travels over Realtime, never page snapshots.
export function createPublicationUpdates(client: SupabaseClient): PublicationUpdates {
  return {
    subscribe(institutionId, onUpdate) {
      let active = true;
      let lastRevision: number | undefined;
      let request = 0;
      const accept = (revision: unknown) => {
        if (!active || typeof revision !== 'number' || !Number.isSafeInteger(revision)) return;
        if (lastRevision !== undefined && revision > lastRevision) onUpdate();
        lastRevision = Math.max(lastRevision ?? 0, revision);
      };
      const channel = client.channel(`portal-publication:${institutionId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'portal_publication_revisions',
          filter: `institution_id=eq.${institutionId}`,
        }, ({ new: row }) => {
          if ('institution_id' in row && row.institution_id === institutionId) {
            // An event after subscription means a publication, even before baseline read.
            if (lastRevision === undefined && active) onUpdate();
            accept('revision' in row ? row.revision : undefined);
          }
        })
        .subscribe(status => {
          if (status !== 'SUBSCRIBED' || !active) return;
          const current = ++request;
          // One small read on connection/reconnection recovers missed events. No polling.
          void Promise.resolve(client.from('portal_publication_revisions').select('revision')
            .eq('institution_id', institutionId).maybeSingle())
            .then(({ data, error }) => {
              if (active && current === request && !error) accept(data?.revision ?? 0);
            }).catch(() => { /* Keep the current page usable when offline. */ });
        });
      return () => { active = false; void client.removeChannel(channel); };
    },
  };
}
