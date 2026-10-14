import type { Document, Chunk, AskRequest, AskResponse } from 'shared-types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  upload: (file: File): Promise<{ document: Document; chunks: Chunk[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/upload', { method: 'POST', body: formData, headers: {} });
  },

  getDocuments: (): Promise<Document[]> => request('/documents'),

  getDocument: (id: string): Promise<{ document: Document; chunks: Chunk[] }> => request(`/documents/${id}`),

  ask: (data: AskRequest): Promise<AskResponse> => request('/ask', { method: 'POST', body: JSON.stringify(data) })
};