import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extractText } from '../services/document.js';
import { chunkPages } from '../services/chunking.js';
import { saveDocument } from '../services/store.js';
import { Document } from '@oza24/shared-types';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'application/vnd.fdf',
      'text/plain'
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files allowed'));
    }
  }
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname, size } = req.file;
    const documentId = uuidv4();

    const pages = await extractText(buffer, mimetype);
    const chunks = chunkPages(pages, documentId);

    const document: Document = {
      id: documentId,
      filename: originalname,
      mimeType: mimetype as Document['mimeType'],
      pageCount: pages.length,
      uploadedAt: new Date().toISOString(),
      sizeBytes: size
    };

    saveDocument(document, chunks);

    res.status(201).json({ document, chunks });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(500).json({ error: message });
  }
});

export default router;