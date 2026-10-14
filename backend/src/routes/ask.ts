import { Router, Request, Response } from 'express';
import { getDocument } from '../services/store.js';
import { searchBM25, ScoredChunk } from '../services/retrieval.js';
import { generateAnswer } from '../services/llm.js';
import { AskRequest, AskResponse, Chunk } from 'shared-types';

const router = Router();

router.post('/ask', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { question, documentIds, topK = 5 }: AskRequest = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }
    if (!documentIds?.length) {
      return res.status(400).json({ error: 'At least one documentId required' });
    }

    const allChunks: Chunk[] = [];

    for (const docId of documentIds) {
      const doc = getDocument(docId);
      if (!doc) {
        return res.status(404).json({ error: `Document not found: ${docId}` });
      }
      allChunks.push(...doc.chunks);
    }

    const retrieved = searchBM25(question, allChunks, topK);
    const context = retrieved.map(r => r.chunk.text).join('\n\n');

    const response = await generateAnswer(question, context, retrieved.map(r => r.chunk));

    const responseWithTime: AskResponse = {
      ...response,
      processingTimeMs: Date.now() - startTime
    };

    res.json(responseWithTime);
  } catch (err) {
    console.error('Ask error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate answer';
    res.status(500).json({ error: message });
  }
});

export default router;