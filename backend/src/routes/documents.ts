import { Router, Request, Response } from 'express';
import { getDocument, getAllDocuments } from '../services/store.js';
import { Document } from 'shared-types';

const router = Router();

router.get('/documents', (_req: Request, res: Response) => {
  const documents = getAllDocuments();
  res.json(documents);
});

router.get('/documents/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const doc = getDocument(id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json(doc);
});

export default router;