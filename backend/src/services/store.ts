import { Document, Chunk } from '@oza24/shared-types';

const documents = new Map<string, { document: Document; chunks: Chunk[] }>();

export function saveDocument(document: Document, chunks: Chunk[]) {
  documents.set(document.id, { document, chunks });
}

export function getDocument(id: string) {
  return documents.get(id);
}

export function getAllDocuments() {
  return Array.from(documents.values()).map(({ document }) => document);
}