import { v4 as uuidv4 } from 'uuid';
import { Chunk } from '@oza24/shared-types';

const TARGET_CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const CHARS_PER_TOKEN = 4;

export function chunkPages(
  pages: { pageNumber: number; text: string }[],
  documentId: string
): Chunk[] {
  const chunks: Chunk[] = [];
  let carryover = '';

  for (const page of pages) {
    const text = carryover + page.text;
    const targetChars = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;
    const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

    for (let i = 0; i < text.length; i += targetChars - overlapChars) {
      const chunkText = text.slice(i, i + targetChars).trim();
      if (!chunkText) continue;

      const tokenCount = Math.ceil(chunkText.length / CHARS_PER_TOKEN);

      chunks.push({
        id: uuidv4(),
        documentId,
        pageNumber: page.pageNumber,
        text: chunkText,
        tokenCount
      });

      carryover = text.slice(i + targetChars - overlapChars, i + targetChars);
    }
  }

  return chunks;
}