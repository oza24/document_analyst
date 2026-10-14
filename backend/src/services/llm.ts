import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { Citation, AskResponse } from '@oza24/shared-types';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// gemini-2.5-flash — confirmed available for this API key
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

const USE_MOCK = process.env.USE_MOCK_LLM === 'true';
console.log(`[LLM] Mode: ${USE_MOCK ? 'MOCK' : 'Gemini 2.5 Flash (real API)'}`);
console.log(`[LLM] API key set: ${!!(process.env.GEMINI_API_KEY)}`);

// ─────────────────────────────────────────────────────────────────────────────
// Imperative verbs commonly found in slide decks (learning outcomes / tasks)
// These lines are NOT explanatory — they tell students what to do, not what
// the concept IS.
// ─────────────────────────────────────────────────────────────────────────────
const SLIDE_IMPERATIVE_VERBS = new Set([
  'analyze', 'analyse', 'apply', 'assess', 'calculate', 'classify', 'compare',
  'complete', 'compose', 'construct', 'contrast', 'create', 'critique',
  'define', 'demonstrate', 'describe', 'design', 'develop', 'differentiate',
  'discuss', 'distinguish', 'evaluate', 'examine', 'explain', 'explore',
  'identify', 'implement', 'interpret', 'investigate', 'justify', 'list',
  'memorize', 'outline', 'predict', 'prepare', 'present', 'produce', 'prove',
  'recall', 'recognize', 'relate', 'review', 'select', 'solve', 'state',
  'study', 'summarize', 'support', 'trace', 'understand', 'use', 'utilize',
  'write',
]);

const STOP_WORDS = new Set([
  'what', 'this', 'that', 'with', 'from', 'have', 'about', 'does',
  'give', 'tell', 'explain', 'the', 'and', 'for', 'are', 'was',
  'each', 'some', 'into', 'them', 'they', 'their', 'will', 'more',
  'also', 'been', 'were', 'has', 'had', 'can', 'its', 'but', 'not',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Slide-artifact detection
// ─────────────────────────────────────────────────────────────────────────────

function isSlideArtifact(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 10) return true;

  const lower = trimmed.toLowerCase();
  const firstWord = lower.split(/\s+/)[0].replace(/[^a-z]/g, '');

  // Learning outcome / discussion topic verb starts
  if (SLIDE_IMPERATIVE_VERBS.has(firstWord) && trimmed.length < 100) return true;

  // Section header patterns
  if (/^(discussion questions?|learning outcomes?|topics? covered|key points?|overview|objectives?|introduction to|main areas?|agenda|outline|recap|review|summary)/i.test(trimmed)) return true;

  // Questions
  if (/[?]$/.test(trimmed)) return true;

  // Slide check marks / bullets used as list items (very short)
  if (/^[✓•▶→–►]\s/.test(trimmed) && trimmed.length < 60) return true;

  // Pure title-case short lines (slide headings): e.g. "Word Formation", "NLP Overview"
  // Must not contain lowercase content words
  if (trimmed.length < 55 && /^[A-Z]/.test(trimmed) && !/[.,:;()\d]/.test(trimmed)) {
    const words = trimmed.split(/\s+/);
    if (words.length <= 5 && words.every(w => /^[A-Z]/.test(w) || ['and', 'or', 'of', 'the', 'in', 'for', 'to', 'a', 'an'].includes(w.toLowerCase()))) {
      return true;
    }
  }

  // Page numbers, lone numbers
  if (/^\d+\.?\s*$/.test(trimmed)) return true;

  // Slide number / footer markers
  if (/^(page|slide)\s+\d+/i.test(trimmed)) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract genuinely informative sentences from raw PDF/slide text
// ─────────────────────────────────────────────────────────────────────────────

function extractContentSentences(text: string): string[] {
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const goodLines: string[] = [];

  for (const line of rawLines) {
    if (!isSlideArtifact(line)) {
      goodLines.push(line);
    }
  }

  // Split lines into sentences on sentence-ending punctuation
  const sentences: string[] = [];
  for (const line of goodLines) {
    const parts = line
      .split(/(?<=[.!])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 25);
    sentences.push(...parts);
  }

  // Deduplicate
  const seen = new Set<string>();
  return sentences.filter(s => {
    const key = s.slice(0, 70).toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rank sentences by relevance to a user query
// ─────────────────────────────────────────────────────────────────────────────

function rankByRelevance(sentences: string[], query: string, maxCount: number = 6): string[] {
  if (sentences.length === 0) return [];

  const queryWords = query.toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  const scored = sentences.map(s => {
    const lower = s.toLowerCase();
    // Exact query word matches (weighted heavily)
    const wordScore = queryWords.reduce((acc, w) => acc + (lower.includes(w) ? 2 : 0), 0);
    // Prefer longer, more informative sentences
    const lengthBonus = Math.min(s.length / 200, 1);
    // Penalise very short fragments
    const lengthPenalty = s.length < 40 ? -1 : 0;
    return { text: s, score: wordScore + lengthBonus + lengthPenalty };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter(s => s.score > 0);
  if (top.length === 0) return sentences.slice(0, maxCount);
  return top.slice(0, maxCount).map(s => s.text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: extract the longest informative sentences regardless of relevance
// ─────────────────────────────────────────────────────────────────────────────

function topSentencesByLength(sentences: string[], count: number = 4): string[] {
  return [...sentences]
    .sort((a, b) => b.length - a.length)
    .slice(0, count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Mock LLM — slide-deck-aware
// ─────────────────────────────────────────────────────────────────────────────

function mockAnswer(
  question: string,
  retrievedChunks: { id: string; documentId: string; pageNumber: number; text: string }[]
): AskResponse {
  if (retrievedChunks.length === 0) {
    return {
      answer: 'No relevant sections were found in this document for your question. Try rephrasing or asking about a specific topic in the document.',
      citations: [],
      confidence: 0.1,
      processingTimeMs: 0,
    };
  }

  // Vague one-word answers like "yes"
  const isTooVague = question.trim().split(/\s+/).length < 3;
  if (isTooVague) {
    return {
      answer: 'Could you be more specific? For example: "Explain what morphology is" or "Give examples of morphemes".',
      citations: [],
      confidence: 0.2,
      processingTimeMs: 0,
    };
  }

  const topChunks = retrievedChunks.slice(0, 6);
  const combinedRaw = topChunks.map(c => c.text).join('\n\n');

  // Extract only genuine content sentences (no slide artifacts)
  const cleanSentences = extractContentSentences(combinedRaw);

  const isSummaryQuery   = /summarize|overview|what.*cover|what.*contain|main.*topics?|key.*points?|about this doc|full summary/i.test(question);
  const isComparisonQuery = /difference|compare|versus|\bvs\b|advantage|disadvantage|better than/i.test(question);
  const isListQuery       = /\blist\b|give.*example|show.*example|example.*of|types? of|kinds? of/i.test(question);
  const isDefinitionQuery = /\bwhat (?:is|are)\b|^define\b|\bdefinition of\b/i.test(question);
  const isExplanationQuery = /explain|how does|how to|describe|tell me|walk.*through|in detail/i.test(question);

  let answer: string;
  if (isSummaryQuery)    answer = buildSummary(topChunks, cleanSentences);
  else if (isComparisonQuery) answer = buildComparison(question, cleanSentences, combinedRaw);
  else if (isListQuery)  answer = buildList(question, cleanSentences, combinedRaw);
  else if (isDefinitionQuery || isExplanationQuery) answer = buildExplanation(question, cleanSentences, combinedRaw);
  else                   answer = buildGeneral(question, cleanSentences, combinedRaw);

  const confidence = cleanSentences.length >= 3 ? 0.82 : cleanSentences.length >= 1 ? 0.55 : 0.25;

  return {
    answer,
    citations: topChunks.slice(0, 3).map(c => ({
      chunkId: c.id,
      documentId: c.documentId,
      pageNumber: c.pageNumber,
      excerpt: c.text.slice(0, 200),
    })),
    confidence,
    processingTimeMs: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer builders
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(
  chunks: { text: string; pageNumber: number }[],
  sentences: string[]
): string {
  // Grab the best 1 content line per chunk as a "topic anchor"
  const topicLines: string[] = [];
  for (const chunk of chunks.slice(0, 5)) {
    const lines = chunk.text.split('\n').map(l => l.trim());
    for (const line of lines) {
      if (!isSlideArtifact(line) && line.length > 20 && line.length < 120) {
        topicLines.push(`- ${line} *(Pg ${chunk.pageNumber})*`);
        break;
      }
    }
  }

  const bodyPoints = topSentencesByLength(sentences, 4);

  let out = '';
  if (topicLines.length > 0) {
    out += `**Key content in this document:**\n\n${topicLines.join('\n')}\n\n`;
  }
  if (bodyPoints.length > 0) {
    out += `**Summary:**\n\n${bodyPoints.join('\n\n')}`;
  }
  if (!out.trim()) {
    out = 'This document covers several related topics. Try asking about a specific concept for a detailed explanation.';
  }
  return out.trim();
}

function buildExplanation(question: string, sentences: string[], rawContent: string): string {
  const relevant = rankByRelevance(sentences, question, 8);

  if (relevant.length === 0) {
    // Last resort: pull longest raw sentences ignoring all filtering
    const emergency = rawContent
      .split(/\n/)
      .map(l => l.trim())
      .filter(l => l.length > 50 && !/[?]$/.test(l) && !SLIDE_IMPERATIVE_VERBS.has(l.split(' ')[0]?.toLowerCase()))
      .sort((a, b) => b.length - a.length)
      .slice(0, 4);

    if (emergency.length === 0) {
      return 'I found related sections but was not able to extract a clear explanatory answer. The document may be a slide deck with limited prose. Try asking a very specific question like "What is morphology?" or "Give an example of a morpheme".';
    }
    return emergency.join('\n\n');
  }

  // Extract term from question for bolding in header
  const termRx = /(?:what (?:is|are)|explain(?:\s+me)?(?:\s+what\s+(?:is|are))?|define|describe)\s+([\w\s/-]+?)(?:\s+and\b|\s+with\b|\s+in\b|\?|$)/i;
  const termMatch = question.match(termRx);
  const term = termMatch?.[1]?.trim() ?? '';

  // Separate into concepts, steps, and examples
  const concepts: string[] = [];
  const steps: string[] = [];
  const examples: string[] = [];

  for (const s of relevant) {
    const lower = s.toLowerCase();
    if (/\bstep\b|\bstage\b|\bfirst[,\s]|\bthen\b|\bnext\b|\bfinally\b/.test(lower)) {
      steps.push(s);
    } else if (/\bexample\b|\binstance\b|\be\.g\b|\bsuch as\b|\bfor instance\b|\blike\b/.test(lower) ||
               /\bplaying\b|\bunhappy\b|\bstudents?\b|\bplayed\b|\bbooks\b/.test(lower)) {
      examples.push(s);
    } else {
      concepts.push(s);
    }
  }

  let out = '';
  if (term) out += `**${term.charAt(0).toUpperCase() + term.slice(1)}**\n\n`;

  if (concepts.length > 0) {
    out += concepts.join('\n\n') + '\n\n';
  }
  if (steps.length > 0) {
    out += `**How it works:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
  }
  if (examples.length > 0) {
    out += `**Examples from the document:**\n${examples.map(s => `- ${s}`).join('\n')}`;
  }

  return out.trim() || relevant.join('\n\n');
}

function buildComparison(question: string, sentences: string[], rawContent: string): string {
  const relevant = rankByRelevance(sentences, question, 6);
  if (relevant.length === 0) {
    return 'The retrieved sections do not directly compare these items. Try asking about each concept individually for a clearer answer.';
  }
  return `**Comparison from the document:**\n\n${relevant.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}`;
}

function buildList(question: string, sentences: string[], rawContent: string): string {
  const relevant = rankByRelevance(sentences, question, 8);
  if (relevant.length === 0) {
    return 'No specific list was found in the retrieved sections. Try being more specific, e.g. "List types of morphemes".';
  }
  return `**From the document:**\n\n${relevant.map(s => `- ${s}`).join('\n\n')}`;
}

function buildGeneral(question: string, sentences: string[], rawContent: string): string {
  const relevant = rankByRelevance(sentences, question, 5);
  if (relevant.length === 0) return buildExplanation(question, sentences, rawContent);
  return relevant.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Real Gemini API integration
// ─────────────────────────────────────────────────────────────────────────────

export async function generateAnswer(
  question: string,
  context: string,
  retrievedChunks: { id: string; documentId: string; pageNumber: number; text: string }[]
): Promise<AskResponse> {
  if (USE_MOCK) {
    return mockAnswer(question, retrievedChunks);
  }

  const prompt = buildPrompt(question, retrievedChunks);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            answer:   { type: SchemaType.STRING },
            citations: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  chunkId:    { type: SchemaType.STRING },
                  documentId: { type: SchemaType.STRING },
                  pageNumber: { type: SchemaType.INTEGER },
                  excerpt:    { type: SchemaType.STRING },
                },
                required: ['chunkId', 'documentId', 'pageNumber', 'excerpt'] as string[],
              },
            },
            confidence: { type: SchemaType.NUMBER },
          },
          required: ['answer', 'citations', 'confidence'] as string[],
        },
      },
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
      answer: parsed.answer,
      citations: validateCitations(parsed.citations, retrievedChunks),
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      processingTimeMs: 0,
    };
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('timeout');
    const isQuota   = [429, 503, 504].includes(error.status);

    if (isTimeout || isQuota) {
      console.warn(`[LLM] Falling back to mock: ${isTimeout ? 'timeout' : `HTTP ${error.status}`}`);
      return mockAnswer(question, retrievedChunks);
    }
    throw error;
  }
}

function buildPrompt(
  question: string,
  chunks: { id: string; documentId: string; pageNumber: number; text: string }[]
): string {
  const chunkRefs = chunks
    .map((c, i) => `[Chunk ${i + 1}] id=${c.id} page=${c.pageNumber}\n${c.text}`)
    .join('\n\n---\n\n');

  return `You are an expert AI that answers questions using ONLY the document excerpts provided.

CONTEXT: The document may be a slide deck. Slide decks often contain:
- Learning objective lines starting with verbs like "Explain...", "Analyze...", "Understand..."
- Discussion question lists
- Short title/header lines
- Actual content mixed in with the above

YOUR TASK:
1. IGNORE all learning objective lines (e.g. "Explain inflectional morphology with examples")
2. IGNORE discussion question lists
3. IGNORE slide section headers
4. Focus ONLY on actual explanatory content — definitions, prose descriptions, examples, diagrams described in text
5. Synthesise a clear, well-written answer in natural language
6. Use **bold** for key terms
7. If the answer involves steps or types, use a numbered or bullet list
8. Cite page numbers inline: "Morphology is the study of word structure [Page 4]."
9. Do NOT include a "Sources:" section — citations are shown separately

Question: ${question}

Document Excerpts:
${chunkRefs}

Return valid JSON only with keys: answer (string), citations (array), confidence (0–1 number).`;
}

function validateCitations(
  citations: Citation[],
  retrievedChunks: { id: string; documentId: string; pageNumber: number; text: string }[]
): Citation[] {
  const chunkMap = new Map(retrievedChunks.map(c => [c.id, c]));
  return citations
    .filter(c => chunkMap.has(c.chunkId))
    .map(c => {
      const chunk = chunkMap.get(c.chunkId)!;
      return {
        chunkId:    c.chunkId,
        documentId: c.documentId,
        pageNumber: chunk.pageNumber,
        excerpt:    c.excerpt.slice(0, 200),
      };
    });
}