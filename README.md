# EvidenceLens — AI Document Analyst

> An intelligent document analysis system that uploads PDFs/TXTs, extracts content, and answers questions with verifiable citations.

---

## 🎯 Problem Statement

Build an intelligent AI document analyst within 48 hours that:
- Uploads and processes PDF/TXT documents
- Answers questions grounded in document content
- Provides verifiable citations linking back to source pages
- Demonstrates engineering judgment, not just tutorial reproduction

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EvidenceLens Architecture                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Frontend   │────▶│   Backend    │────▶│   Services   │                │
│  │  (React/Vite)│     │  (Express)   │     │  (Core)      │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│        │                    │                    │                         │
│        ▼                    ▼                    ▼                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Processing Pipeline                             │  │
│  │  Upload → Extract (pdf-parse) → Chunk (500 tokens) → Store (Map)     │  │
│  │                                                    │                   │
│  │  Query → BM25 Retrieval → Mock/Real LLM → Validate → Response        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Monorepo Structure
```
evidencelens/
├── packages/
│   └── shared-types/          # Shared TypeScript interfaces
├── frontend/                  # React + Vite + TypeScript
│   ├── src/
│   │   ├── api/client.ts      # API client with typed methods
│   │   ├── pages/UploadPage.tsx
│   │   ├── pages/ChatPage.tsx
│   │   └── App.tsx
│   └── vite.config.ts         # Proxy config for /api
├── backend/                   # Express + TypeScript
│   ├── src/
│   │   ├── index.ts           # Express app + routes
│   │   ├── routes/
│   │   │   ├── upload.ts      # POST /api/upload
│   │   │   ├── ask.ts         # POST /api/ask
│   │   │   └── documents.ts   # GET /api/documents
│   │   ├── services/
│   │   │   ├── document.ts    # PDF/TXT extraction (pdf-parse)
│   │   │   ├── chunking.ts    # Sliding window chunking (500 tokens, 50 overlap)
│   │   │   ├── retrieval.ts   # BM25 keyword search
│   │   │   ├── llm.ts         # Gemini 1.5 Flash + mock fallback
│   │   │   └── store.ts       # In-memory Map storage
│   │   └── routes/documents.ts
│   ├── tsconfig.json
│   └── package.json
├── package.json               # Root workspace
└── README.md
```

---

## 🔧 Core Components

### 1. Document Processing (`backend/src/services/document.ts`)
- **PDF**: Uses `pdf-parse` (pdf.js-based) for text extraction with page mapping
- **TXT**: UTF-8 decode with heuristic page splitting (~3000 chars/page)
- **Output**: Array of `{ pageNumber, text }` for citation mapping

### 2. Chunking (`backend/src/services/chunking.ts`)
- **Strategy**: Sliding window (500 tokens target, 50 token overlap)
- **Token estimation**: ~4 chars/token
- **Metadata preserved**: `chunkId`, `documentId`, `pageNumber`, `tokenCount`

### 3. Retrieval (`backend/src/services/retrieval.ts`)
- **Algorithm**: BM25 (TF-IDF variant)
- **Scoring**: TF normalized by document length, IDF with smoothing
- **No external dependencies**: Pure TypeScript implementation

### 4. LLM Integration (`backend/src/services/llm.ts`)
- **Model**: Google Gemini 1.5 Flash (`gemini-flash-latest`)
- **Structured output**: JSON schema via `responseSchema`
- **Citation validation**: Filters hallucinated citations against retrieved chunks
- **Fallback**: High-quality mock when API quota exceeded (429/503/timeout)

### 5. Frontend (`frontend/src/`)
- **UploadPage**: Drag-drop, file validation (PDF/TXT, ≤10MB), progress
- **ChatPage**: Real-time chat with citation badges `[Page X]`
- **Routing**: React Router (`/` → upload, `/chat/:id` → chat)

---

## 🎯 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **BM25 over embeddings** | No vector DB needed; explainable scoring; fast for keyword queries; zero external deps |
| **Gemini 1.5 Flash** | 1M token context; free tier generous; native JSON schema; sub-second latency |
| **Mock fallback** | Ensures demo works despite API quota; indistinguishable format |
| **In-memory store** | MVP simplicity; swap for Redis/DB in production |
| **Page-based citations** | Human-verifiable; maps to PDF pages; works for TXT heuristics |
| **Monorepo + shared types** | Type-safe API contracts; single source of truth; easy refactoring |

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20
- npm ≥ 10

### Installation
```bash
# Install all workspace dependencies
npm install

# Build all packages
npm run build
```

### Development
```bash
# Start backend (port 3001)
cd backend && npm run dev

# Start frontend (port 5173)
cd frontend && npm run dev
```

### Environment Variables
Create `backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
USE_MOCK_LLM=false  # Set true for demo without API key
```

---

## 📡 API Reference

### `POST /api/upload`
Upload a PDF or TXT file.
```bash
curl -X POST -F "file=@document.pdf" http://localhost:3001/api/upload
```
**Response:**
```json
{
  "document": {
    "id": "uuid",
    "filename": "doc.pdf",
    "mimeType": "application/pdf",
    "pageCount": 5,
    "uploadedAt": "2026-10-14T10:00:00.000Z",
    "sizeBytes": 102400
  },
  "chunks": [{ "id": "...", "documentId": "...", "pageNumber": 1, "text": "...", "tokenCount": 450 }]
}
```

### `POST /api/ask`
Ask a question about uploaded documents.
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"question": "What is LSTM?", "documentIds": ["doc-id"], "topK": 5}' \
  http://localhost:3001/api/ask
```
**Response:**
```json
{
  "answer": "LSTM (Long Short-Term Memory) is a specialized RNN architecture...",
  "citations": [
    { "chunkId": "...", "documentId": "...", "pageNumber": 3, "excerpt": "LSTM uses four gates..." }
  ],
  "confidence": 0.92,
  "processingTimeMs": 1234
}
```

### `GET /api/documents`
List all uploaded documents.

### `GET /api/documents/:id`
Get document with all chunks.

### `GET /health`
Health check.

---

## 🧪 Testing the Mock
Set `USE_MOCK_LLM=true` in `.env` to test without API key. The mock produces:
- **Summaries**: Structured topic overview with page citations
- **Definitions**: Bold term header + extracted definition
- **Explanations**: Key concepts + process steps + examples
- **Comparisons**: Numbered list with structured formatting

---

## 📦 Deployment

### Backend (Render / Railway)
1. Connect GitHub repo
2. Build: `npm run build`
3. Start: `npm start`
4. Env vars: `GEMINI_API_KEY`, `PORT`, `USE_MOCK_LLM=false`

### Frontend (Vercel / Netlify)
1. Connect GitHub repo
2. Build: `npm run build`
3. Output: `dist`
4. Env var: `VITE_API_URL=https://your-backend.onrender.com`

---

## 📊 Evaluation Criteria Coverage

| VEGAH Criterion | Implementation |
|-----------------|----------------|
| **Document intelligence** | PDF/TXT extraction with page mapping |
| **Grounded AI responses** | BM25 retrieval + LLM with citation validation |
| **Intelligent model selection** | Gemini 1.5 Flash rationale documented |
| **Efficiency optimization** | BM25 (no vector DB), 30s timeout, mock fallback |
| **Autonomous orchestration** | Upload→Extract→Chunk→Store→Retrieve→LLM |
| **Production thinking** | Validation, error handling, typed contracts, proxy |

---

## 🧠 What I Learned

- **API integration challenges**: Google AI Studio keys (`AQ...`) vs traditional (`AIza...`); model naming differences
- **BM25 implementation**: TF-IDF with length normalization; practical for keyword retrieval
- **Mock-first development**: Enables full-stack demo without API dependency; seamless fallback
- **TypeScript monorepo**: Shared types eliminate API contract drift; catch errors at compile time
- **Citation validation**: Critical for trust; filters hallucinated references post-generation

---

## ⚖️ Trade-offs

| Chose | Over | Reason |
|-------|------|--------|
| BM25 | Vector embeddings | No infra; explainable; fast for exact-match |
| In-memory Map | Redis/PostgreSQL | MVP speed; documented as known limitation |
| Mock LLM fallback | Pure real API | Guarantees demo works; quota-proof |
| Page-based citations | Character offsets | Human-readable; PDF-native; TXT heuristic |

---

## 📁 Project Structure Summary

```
evidencelens/
├── README.md
├── package.json                    # Root workspace
├── packages/
│   └── shared-types/               # Document, Chunk, Citation, AskRequest, AskResponse
├── frontend/
│   ├── src/
│   │   ├── api/client.ts
│   │   ├── pages/UploadPage.tsx
│   │   ├── pages/ChatPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts              # /api proxy
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/upload.ts
│   │   ├── routes/ask.ts
│   │   ├── routes/documents.ts
│   │   ├── services/document.ts
│   │   ├── services/chunking.ts
│   │   ├── services/retrieval.ts
│   │   ├── services/llm.ts
│   │   └── services/store.ts
│   ├── tsconfig.json
│   └── package.json
└── .gitignore
```

---

## 📄 License

MIT License — Built for VEGAH Round 2 AI Engineering Challenge.

---

## 🙏 Acknowledgments

- **pdf-parse** for PDF extraction
- **Google Gemini** for LLM capabilities
- **BM25** algorithm (Robertson & Zaragoza)
- **VEGAH** for the challenge

---

*Built with ❤️ in 48 hours for VEGAH Round 2*/ /   t r i g g e r   d e p l o y  
 