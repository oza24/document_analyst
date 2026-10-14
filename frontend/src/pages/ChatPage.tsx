import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Document, Chunk, Citation, AskResponse } from '@oza24/shared-types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: number;
  timestamp: Date;
}

const HINT_QUESTIONS = [
  'Summarize this document',
  'What are the main topics?',
  'List key concepts',
  'Explain the most important idea',
];

/** Line-by-line markdown → JSX-safe HTML */
function renderMarkdown(text: string): string {
  const inlineBold = (s: string) =>
    s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
     .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  const lines = text.split('\n');
  const output: string[] = [];
  let inList = false;
  let listTag = 'ul';
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      output.push(`<p>${paragraphBuffer.map(inlineBold).join('<br/>')}</p>`);
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (inList) {
      output.push(`</${listTag}>`);
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Blank line → flush
    if (line === '') {
      flushList();
      flushParagraph();
      continue;
    }

    // Numbered list:  1. item
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      flushParagraph();
      if (!inList || listTag !== 'ol') {
        flushList();
        output.push('<ol>');
        inList = true; listTag = 'ol';
      }
      output.push(`<li>${inlineBold(numberedMatch[2])}</li>`);
      continue;
    }

    // Bullet list:  - item  or  • item
    const bulletMatch = line.match(/^[-•]\s+(.+)/);
    if (bulletMatch) {
      flushParagraph();
      if (!inList || listTag !== 'ul') {
        flushList();
        output.push('<ul>');
        inList = true; listTag = 'ul';
      }
      output.push(`<li>${inlineBold(bulletMatch[1])}</li>`);
      continue;
    }

    // Normal text line
    flushList();
    paragraphBuffer.push(line);
  }

  flushList();
  flushParagraph();
  return output.join('');
}

export function ChatPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [, setChunks] = useState<Chunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (documentId) loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      const data = await api.getDocument(documentId!);
      setDocument(data.document);
      setChunks(data.chunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleAsk = async (question: string) => {
    const q = question.trim();
    if (!q || !documentId || loading) return;

    setInput('');
    setLoading(true);
    setError(null);

    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: new Date() }]);

    try {
      const response: AskResponse = await api.ask({ question: q, documentIds: [documentId], topK: 5 });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        confidence: response.confidence,
        timestamp: new Date()
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAsk(input);
  };

  if (!document) {
    return (
      <div className="loading">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
        </svg>
        Loading document...
      </div>
    );
  }

  return (
    <div className="chat-page">
      {/* Header */}
      <header className="chat-header">
        <Link to="/" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          New
        </Link>

        <div className="doc-info">
          <h2>{document.filename}</h2>
          <div className="doc-meta">
            <span>{document.pageCount} pages</span>
            <span className="doc-meta-dot"/>
            <span>{document.mimeType === 'application/pdf' ? 'PDF' : 'Text'}</span>
            <span className="doc-meta-dot"/>
            <span>{(document.sizeBytes / 1024).toFixed(0)} KB</span>
          </div>
        </div>

        <div className="ai-badge">
          <span className="ai-dot"/>
          Gemini AI
        </div>
      </header>

      {/* Messages */}
      <main className="chat-main">
        <div className="messages">
          {messages.length === 0 && !loading ? (
            <div className="welcome-state">
              <svg className="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>Ask anything about <strong style={{color:'var(--text-primary)'}}>{document.filename}</strong></p>
              <div className="welcome-hints">
                {HINT_QUESTIONS.map(q => (
                  <button key={q} className="hint-chip" onClick={() => handleAsk(q)}>{q}</button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-meta">
                <span className="message-role">{msg.role === 'user' ? 'You' : 'EvidenceLens'}</span>
              </div>

              <div className="message-content">
                {msg.role === 'assistant' ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : (
                  <p>{msg.content}</p>
                )}

                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                  <div className="citations">
                    {msg.citations.map(c => (
                      <span
                        key={c.chunkId}
                        className="citation-badge"
                        title={`Page ${c.pageNumber}: ${c.excerpt}`}
                      >
                        Pg {c.pageNumber}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === 'assistant' && typeof msg.confidence === 'number' && (
                <div className="confidence-row">
                  <div className="confidence-bar">
                    <div className="confidence-fill" style={{ width: `${msg.confidence * 100}%` }} />
                  </div>
                  <span className="confidence-label">{Math.round(msg.confidence * 100)}% confidence</span>
                </div>
              )}

              <time className="message-time">{msg.timestamp.toLocaleTimeString()}</time>
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="message-meta"><span className="message-role">EvidenceLens</span></div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span className="typing-dot"/>
                  <span className="typing-dot"/>
                  <span className="typing-dot"/>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error-banner">⚠ {error}</div>}

        <form onSubmit={handleSubmit} className="chat-form">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about this document…"
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={!input.trim() || loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </form>
      </main>
    </div>
  );
}