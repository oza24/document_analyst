import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload.js';
import askRouter from './routes/ask.js';
import documentsRouter from './routes/documents.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

app.get('/health', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
  res.json(response);
});

app.use('/api', uploadRouter);
app.use('/api', askRouter);
app.use('/api', documentsRouter);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});