export interface Document {
  id: string;
  filename: string;
  mimeType: 'application/pdf' | 'text/plain';
  pageCount: number;
  uploadedAt: string;
  sizeBytes: number;
}

export interface Chunk {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  tokenCount: number;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  pageNumber: number;
  excerpt: string;
}

export interface AskRequest {
  question: string;
  documentIds: string[];
  topK?: number;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
  processingTimeMs: number;
}