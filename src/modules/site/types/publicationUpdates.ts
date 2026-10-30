export interface PublicationUpdates {
  subscribe(institutionId: string, onUpdate: () => void): () => void;
}
