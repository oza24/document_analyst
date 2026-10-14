import { Chunk } from '@oza24/shared-types';

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

interface SearchableChunk {
  id: string;
  text: string;
  documentId: string;
  pageNumber: number;
  tokenCount: number;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) || [];
}

function buildTermIndex(chunks: SearchableChunk[]): Map<string, Map<string, number>> {
  const index = new Map<string, Map<string, number>>();
  for (const chunk of chunks) {
    const terms = tokenize(chunk.text);
    const tf = new Map<string, number>();
    for (const term of terms) {
      tf.set(term, (tf.get(term) || 0) + 1);
    }
    for (const [term, count] of tf) {
      if (!index.has(term)) index.set(term, new Map());
      index.get(term)!.set(chunk.id, count);
    }
  }
  return index;
}

function computeDocLengths(chunks: SearchableChunk[]): Map<string, number> {
  const lengths = new Map<string, number>();
  for (const chunk of chunks) {
    lengths.set(chunk.id, tokenize(chunk.text).length);
  }
  return lengths;
}

export function searchBM25(
  query: string,
  chunks: SearchableChunk[],
  topK: number = 5
): ScoredChunk[] {
  if (chunks.length === 0) return [];

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const index = buildTermIndex(chunks);
  const docLengths = computeDocLengths(chunks);
  const avgDocLength = Array.from(docLengths.values()).reduce((a, b) => a + b, 0) / chunks.length;
  const totalDocs = chunks.length;

  const k1 = 1.5;
  const b = 0.75;

  const scores = new Map<string, number>();

  for (const term of queryTerms) {
    const postings = index.get(term);
    if (!postings) continue;

    const df = postings.size;
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

    for (const [chunkId, tf] of postings) {
      const docLen = docLengths.get(chunkId) || 1;
      const tfNorm = tf / (tf + k1 * (1 - b + b * (docLen / avgDocLength)));
      scores.set(chunkId, (scores.get(chunkId) || 0) + idf * tfNorm);
    }
  }

  const scored: ScoredChunk[] = [];
  for (const [chunkId, score] of scores) {
    const chunk = chunks.find(c => c.id === chunkId);
    if (chunk) scored.push({ chunk: chunk as Chunk, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}