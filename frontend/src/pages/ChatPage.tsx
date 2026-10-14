import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Document, Chunk, Citation, AskResponse } from '@oza24/shared-types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export function ChatPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !documentId || loading) return;

    const question = input.trim();
    setInput('');
    setLoading(true);
    setError(null);

    const userMessage: Message = { role: 'user', content: question, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response: AskResponse = await api.ask({
        question,
        documentIds: [documentId],
        topK: 5
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
      setMessages(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setLoading(false);
    }
  };

  const formatCitation = (citation: Citation) => (
    <span key={citation.chunkId} className="citation-badge" title={`Page ${citation.pageNumber}: ${citation.excerpt}`}>
      [{citation.pageNumber}]
    </span>
  );

  if (!document) {
    return <div className="loading">Loading document...</div>;
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <Link to="/" className="back-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          New Document
        </Link>
        <div className="doc-info">
          <h2>{document.filename}</h2>
          <span className="doc-meta">{document.pageCount} pages · {document.mimeType === 'application/pdf' ? 'PDF' : 'Text'}</span>
        </div>
      </header>

      <main className="chat-main">
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-content">
                <p>{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="citations">
                    {msg.citations.map(formatCitation)}
                  </div>
                )}
              </div>
              <time className="message-time">{msg.timestamp.toLocaleTimeString()}</time>
            </div>
          ))}
          {loading && <div className="message assistant loading"><span className="typing-indicator">●●●</span></div>}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleAsk} className="chat-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about this document..."
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={!input.trim() || loading}>
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </main>
    </div>
  );
}