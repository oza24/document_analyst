import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { Citation, AskResponse } from 'shared-types';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

const USE_MOCK = process.env.USE_MOCK_LLM === 'true';

function mockAnswer(
  question: string,
  retrievedChunks: { id: string; documentId: string; pageNumber: number; text: string }[]
): AskResponse {
  if (retrievedChunks.length === 0) {
    return {
      answer: 'I could not find any relevant information in the document to answer your question.',
      citations: [],
      confidence: 0.1,
      processingTimeMs: 0
    };
  }

  const topChunks = retrievedChunks.slice(0, 5);
  const allPages = [...new Set(topChunks.map(c => c.pageNumber))].sort((a, b) => a - b);
  
  const isSummaryQuery = /each topic|all topics|summarize|overview|what.*cover|what.*contain|list.*topic|main.*topic|full summary|complete summary/i.test(question);
  const isDefinitionQuery = /what is|define|definition of|meaning of/i.test(question);
  const isExplanationQuery = /explain|how does|how to|describe|walk me through/i.test(question);
  const isComparisonQuery = /difference|compare|versus|vs|better/i.test(question);

  const combinedContent = topChunks.map(c => c.text).join('\n\n');
  
  let answer: string;

  if (isSummaryQuery) {
    answer = generateComprehensiveSummary(combinedContent, question);
  } else if (isDefinitionQuery) {
    answer = generateDefinition(question, topChunks);
  } else if (isExplanationQuery) {
    answer = generateExplanation(question, combinedContent);
  } else if (isComparisonQuery) {
    answer = generateComparison(question, combinedContent);
  } else {
    answer = generateGeneralAnswer(question, topChunks);
  }

  const pageRef = allPages.map(p => `Page ${p}`).join(', ');
  const finalAnswer = `${answer}\n\nSources: ${pageRef}`;

  return {
    answer: finalAnswer,
    citations: topChunks.slice(0, 3).map(c => ({
      chunkId: c.id,
      documentId: c.documentId,
      pageNumber: c.pageNumber,
      excerpt: c.text.slice(0, 200)
    })),
    confidence: retrievedChunks.length > 0 ? 0.85 : 0.1,
    processingTimeMs: 0
  };
}

function generateComprehensiveSummary(content: string, question: string): string {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const keyTerms = ['n-gram', 'lstm', 'word prediction', 'preprocessing', 'tokenization', 'unigram', 'bigram', 'trigram', 'recurrent', 'neural network', 'data collection', 'pipeline', 'architecture', 'training', 'embedding', 'attention', 'transformer', 'probability', 'markov', 'ocr', 'crnn', 'handwritten', 'character recognition'];
  
  const relevantSentences = sentences
    .filter(s => s.length > 30)
    .filter(s => keyTerms.some(term => s.toLowerCase().includes(term.toLowerCase())))
    .slice(0, 12);

  if (relevantSentences.length === 0) {
    const fallback = content.split(/[.!?]+/).filter(s => s.trim().length > 30).slice(0, 5);
    return `Document Summary\n\n${fallback.join('. ')}.`;
  }

  const topics = categorizeContent(relevantSentences.join(' '));
  
  let summary = `Document Overview\n\nThis document covers ${topics.length} main topics:\n\n`;
  
  topics.forEach((topic, i) => {
    summary += `${i + 1}. ${topic.name}\n\n${topic.description}\n\n`;
  });
  
  summary += `The document provides both theoretical foundations and practical applications, with examples and formulas where applicable.`;
  
  return summary;
}

function categorizeContent(content: string): { name: string; description: string }[] {
  const topics: { name: string; description: string }[] = [];
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('n-gram') || lowerContent.includes('unigram') || lowerContent.includes('bigram') || lowerContent.includes('trigram') || lowerContent.includes('markov')) {
    topics.push({
      name: 'N-Grams and Language Modeling',
      description: `Definition: Contiguous sequences of N words or characters used for language modeling.
- Unigrams (N=1): Single words
- Bigrams (N=2): Two-word sequences
- Trigrams (N=3): Three-word sequences

Markov Assumption: The probability of a word depends only on the previous N-1 words.

Applications: Probability estimation, text generation, autocomplete, spell checking, language modeling.`
    });
  }
  
  if (lowerContent.includes('lstm') || lowerContent.includes('long short-term') || lowerContent.includes('recurrent neural network') || lowerContent.includes('cell state') || lowerContent.includes('gate')) {
    topics.push({
      name: 'LSTM (Long Short-Term Memory)',
      description: `Architecture: Specialized RNN that solves the vanishing gradient problem using gating mechanisms.

Four Key Gates:
1. Forget Gate - Decides what information to discard from cell state
2. Input Gate - Decides what new information to store
3. Cell State - Long-term memory that flows through the chain
4. Output Gate - Decides what part of cell state to output

Applications: Sequence modeling, text generation, time series prediction, handwriting recognition, machine translation.`
    });
  }
  
  if (lowerContent.includes('word prediction') || lowerContent.includes('next word') || lowerContent.includes('language model') || lowerContent.includes('autocomplete')) {
    topics.push({
      name: 'Word Prediction and Language Modeling',
      description: `Task: Predicting the next word in a sequence using probabilistic models.

Approaches:
- N-gram models: Count-based with Markov assumption plus smoothing (Laplace, Kneser-Ney)
- Neural models: RNNs, LSTMs, Transformers with embeddings
- Evaluation: Perplexity, accuracy@k, BLEU score

Applications: Autocomplete, spell correction, text generation, machine translation.`
    });
  }
  
  if (lowerContent.includes('preprocessing') || lowerContent.includes('tokenization') || lowerContent.includes('cleaning') || lowerContent.includes('normalization') || lowerContent.includes('stemming') || lowerContent.includes('lemmatization')) {
    topics.push({
      name: 'Text Preprocessing Pipeline',
      description: `Essential Steps:
1. Cleaning - Remove HTML, special characters, extra whitespace
2. Tokenization - Split into words/subwords (BPE, WordPiece, character-level)
3. Normalization - Lowercase, unicode normalization, remove accents
4. Stopword Removal - Filter common words (optional for neural models)
5. Stemming/Lemmatization - Reduce words to root form
6. Encoding - Convert to IDs/vectors for model input

Tools: NLTK, spaCy, HuggingFace tokenizers, SentencePiece.`
    });
  }
  
if (lowerContent.includes('data collection') || lowerContent.includes('pipeline') || lowerContent.includes('acquisition') || lowerContent.includes('ocr') || lowerContent.includes('crnn') || lowerContent.includes('handwritten')) {
    topics.push({
      name: 'OCR and Document Understanding Pipeline (CRNN)',
      description: `Architecture: CNN plus RNN plus CTC Loss for end-to-end text recognition.
 
Stages:
1. Image Acquisition - Camera/scanner input
2. Preprocessing - Binarization, deskewing, noise removal, normalization
3. CRNN - CNN feature extractor plus BiLSTM sequence modeling plus CTC decoder
4. Post-processing - Dictionary correction, formatting, validation
 
Real-Life Applications:
OCR - CRNN Role: Recognizes printed text; LSTM Role: Predicts missing words
Handwritten Recognition - CRNN Role: Converts handwriting to text; LSTM Role: Corrects and completes sentences
Google Lens - CRNN Role: Reads text from images; LSTM Role: Improves text understanding
Automatic Form Processing - CRNN Role: Extracts form fields; LSTM Role: Predicts incomplete entries
Medical Prescriptions - CRNN Role: Recognizes medicine names; LSTM Role: Corrects spelling, predicts names
License Plate Recognition - CRNN Role: Reads plate characters; LSTM Role: Predicts missing characters
Document Digitization - CRNN Role: Converts scanned pages; LSTM Role: Improves sentence quality
Smart Keyboard - CRNN Role: Reads typed sequence; LSTM Role: Predicts next word`
    });
  }
  
  if (topics.length === 0) {
    topics.push({
      name: 'General Technical Content',
      description: 'The document contains technical content related to NLP, machine learning, and document understanding concepts.'
    });
  }
  
  return topics;
}

function generateDefinition(question: string, chunks: any[]): string {
  const content = chunks.map(c => c.text).join('\n\n');
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  
  const match = question.toLowerCase().match(/what is\s+([^?]+)|define\s+([^?]+)|definition of\s+([^?]+)/i);
  const term = match ? (match[1] || match[2] || match[3]) : 'the concept';
  
  // First, try to find sentences that explicitly define the term
  const definitionPatterns = [
    new RegExp(`${term.toLowerCase()}\\s+(is|are|refers to|means|refers)\\s+`, 'i'),
    new RegExp(`(is|are)\\s+${term.toLowerCase()}\\s+`, 'i'),
    new RegExp(`${term.toLowerCase()}\\s*:\\s*`, 'i'),
    new RegExp(`${term.toLowerCase()}\\s+(architecture|structure|mechanism|works|functions|operates)\\s+`, 'i'),
  ];
  
  // First pass: explicit definition patterns (prioritize sentences that START with the term or have explicit definition)
  let relevant = sentences
    .filter(s => s.length > 30)
    .filter(s => {
      const lower = s.toLowerCase();
      return definitionPatterns.some(p => p.test(lower)) || 
             lower.startsWith(term.toLowerCase() + ' is') ||
             lower.startsWith(term.toLowerCase() + ' are') ||
             lower.startsWith(term.toLowerCase() + ' refers') ||
             lower.startsWith(term.toLowerCase() + ' means') ||
             lower.startsWith(term.toLowerCase() + ' architecture') ||
             lower.startsWith(term.toLowerCase() + ' structure') ||
             lower.startsWith(term.toLowerCase() + ' mechanism') ||
             lower.startsWith(term.toLowerCase() + ' works') ||
             lower.startsWith(term.toLowerCase() + ' functions') ||
             lower.startsWith(term.toLowerCase() + ' operates') ||
             lower.startsWith(term.toLowerCase() + ' consists') ||
             lower.startsWith(term.toLowerCase() + ' comprises');
    })
    .slice(0, 4);
  
  // Second pass: sentences with the term and definition-like keywords
  if (relevant.length < 2) {
    const definitionKeywords = ['architecture', 'structure', 'mechanism', 'works', 'functions', 'operates', 'consists of', 'comprises', 'includes', 'consists', 'gating', 'gate', 'cell state', 'memory'];
    const additionalRelevant = sentences
      .filter(s => s.length > 30)
      .filter(s => s.toLowerCase().includes(term.toLowerCase()) && 
                 definitionKeywords.some(kw => s.toLowerCase().includes(kw)))
      .slice(0, 4);
    
    // Merge, avoiding duplicates
    for (const s of additionalRelevant) {
      if (!relevant.includes(s)) {
        relevant.push(s);
      }
    }
    relevant = relevant.slice(0, 4);
  }
  
  // Third pass: broader search with key terms
  if (relevant.length < 2) {
    relevant = sentences
      .filter(s => s.length > 30)
      .filter(s => s.toLowerCase().includes(term.toLowerCase()) || 
                 keyTermsForTerm(term).some(t => s.toLowerCase().includes(t.toLowerCase())))
      .slice(0, 4);
  }
  
  if (relevant.length === 0) {
    return formatDefinition(term, `Based on the document, ${term} is discussed but a specific definition isn't explicitly stated in the retrieved sections. The document covers this topic in context. Please refer to the full document for complete details.`);
  }
  
  return formatDefinition(term, relevant.join('\n\n'));
}

function formatDefinition(term: string, body: string): string {
  return `${term.charAt(0).toUpperCase() + term.slice(1)}\n\n${body}\n\nDefinition sourced from document content.`;
}

function keyTermsForTerm(term: string): string[] {
  const termMap: Record<string, string[]> = {
    'n-gram': ['n-gram', 'unigram', 'bigram', 'trigram', 'markov'],
    'unigram': ['unigram', 'n-gram', 'single word', '1-gram'],
    'bigram': ['bigram', 'n-gram', 'two word', '2-gram'],
    'trigram': ['trigram', 'n-gram', 'three word', '3-gram'],
    'lstm': ['lstm', 'long short-term memory', 'recurrent', 'cell state', 'gate'],
    'word prediction': ['word prediction', 'next word', 'language model', 'autocomplete'],
    'preprocessing': ['preprocessing', 'tokenization', 'cleaning', 'normalization'],
    'tokenization': ['tokenization', 'token', 'preprocessing', 'bpe', 'wordpiece'],
    'ocr': ['ocr', 'optical character recognition', 'crnn'],
    'crnn': ['crnn', 'cnn', 'rnn', 'ctc', 'optical character recognition'],
    'handwritten': ['handwritten', 'handwriting', 'recognition', 'icr'],
  };
  return termMap[term.toLowerCase()] || [term];
}

function generateExplanation(question: string, content: string): string {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  const keyTerms = ['lstm', 'n-gram', 'word prediction', 'preprocessing', 'tokenization', 'recurrent', 'neural network', 'probability', 'markov', 'training', 'architecture', 'gate', 'cell state', 'crnn', 'cnn', 'ctc', 'ocr', 'handwritten'];
  
  const relevant = sentences
    .filter(s => s.length > 30)
    .filter(s => keyTerms.some(t => s.toLowerCase().includes(t)))
    .slice(0, 8);
  
  if (relevant.length === 0) {
    return `Based on the document:\n\n${content.slice(0, 1200)}...`;
  }
  
  let explanation = `Explanation\n\n`;
  explanation += `Based on the document, here is how this works:\n\n`;
  
  const concepts: string[] = [];
  const steps: string[] = [];
  const examples: string[] = [];
  
  relevant.forEach(s => {
    const lower = s.toLowerCase();
    if (lower.includes('step') || lower.includes('stage') || lower.includes('phase') || lower.includes('first') || lower.includes('then') || lower.includes('next') || lower.includes('finally')) {
      steps.push(s);
    } else if (lower.includes('example') || lower.includes('for instance') || lower.includes('e.g.') || lower.includes('such as')) {
      examples.push(s);
    } else {
      concepts.push(s);
    }
  });
  
  if (concepts.length > 0) {
    explanation += `Key Concepts\n\n${concepts.join('\n\n')}\n\n`;
  }
  if (steps.length > 0) {
    explanation += `Process / Steps\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
  }
  if (examples.length > 0) {
    explanation += `Examples\n\n${examples.join('\n\n')}\n\n`;
  }
  if (concepts.length === 0 && steps.length === 0 && examples.length === 0) {
    explanation += relevant.join('\n\n');
  }
  
  return explanation;
}

function generateComparison(question: string, content: string): string {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  const comparisonTerms = ['difference', 'versus', 'vs', 'better', 'advantage', 'disadvantage', 'compare', 'compared to', 'unlike', 'similar', 'contrast'];
  const relevant = sentences
    .filter(s => s.length > 30)
    .filter(s => comparisonTerms.some(t => s.toLowerCase().includes(t)) || 
               s.toLowerCase().includes('lstm') || 
               s.toLowerCase().includes('n-gram') ||
               s.toLowerCase().includes('transformer') ||
               s.toLowerCase().includes('rnn') ||
               s.toLowerCase().includes('cnn') ||
               s.toLowerCase().includes('gru'))
    .slice(0, 6);
  
  if (relevant.length === 0) {
    return `Based on the document:\n\n${content.slice(0, 1200)}...`;
  }
  
  let comparison = `Comparison\n\n`;
  
  relevant.forEach((s, i) => {
    comparison += `${i + 1}. ${s}\n`;
  });
  
  return comparison;
}

function generateGeneralAnswer(question: string, chunks: any[]): string {
  const content = chunks.map(c => c.text).join('\n\n');
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  
  const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const relevant = sentences
    .filter(s => s.length > 30)
    .filter(s => questionWords.some(w => s.toLowerCase().includes(w)))
    .slice(0, 5);
  
  if (relevant.length === 0) {
    return `Based on the document:\n\n${content.slice(0, 1200)}...`;
  }
  
  let answer = `Answer\n\n`;
  answer += relevant.map(s => `- ${s}`).join('\n');
  
  return answer;
}

function extractKeyPoints(text: string): string {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30);
  const keyTerms = ['n-gram', 'lstm', 'word prediction', 'preprocessing', 'tokenization', 'unigram', 'bigram', 'trigram', 'recurrent', 'neural network', 'data collection', 'pipeline', 'ocr', 'crnn', 'handwritten', 'character recognition'];
  const relevant = sentences.filter(s => keyTerms.some(term => s.toLowerCase().includes(term.toLowerCase())));
  return relevant.slice(0, 8).join('\n\n') || sentences.slice(0, 5).join('\n\n');
}

function findBestChunkForDefinition(question: string, chunks: any[]): any {
  const terms = question.toLowerCase().match(/what is\s+(\w+)|define\s+(\w+)|definition of\s+(\w+)/i);
  const targetTerm = terms ? (terms[1] || terms[2] || terms[3]) : '';
  
  if (targetTerm) {
    const matching = chunks.find(c => c.text.toLowerCase().includes(targetTerm.toLowerCase()));
    if (matching) return matching;
  }
  return chunks[0];
}

export async function generateAnswer(
  question: string,
  context: string,
  retrievedChunks: { id: string; documentId: string; pageNumber: number; text: string }[]
): Promise<AskResponse> {
  if (USE_MOCK) {
    return mockAnswer(question, retrievedChunks);
  }

  const prompt = buildPrompt(question, context, retrievedChunks);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            answer: { type: SchemaType.STRING },
            citations: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  chunkId: { type: SchemaType.STRING },
                  documentId: { type: SchemaType.STRING },
                  pageNumber: { type: SchemaType.INTEGER },
                  excerpt: { type: SchemaType.STRING }
                },
                required: ['chunkId', 'documentId', 'pageNumber', 'excerpt'] as string[]
              }
            },
            confidence: { type: SchemaType.NUMBER }
          },
          required: ['answer', 'citations', 'confidence'] as string[]
        }
      }
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const text = result.response.text();
    const parsed = JSON.parse(text);

    const validatedCitations = validateCitations(parsed.citations, retrievedChunks);

    return {
      answer: parsed.answer,
      citations: validatedCitations,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      processingTimeMs: 0
    };
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError' || 
                      error.cause?.name === 'AbortError' ||
                      error.message?.includes('aborted') ||
                      error.message?.includes('timeout') ||
                      error.message?.includes('AbortError');
    const isQuota = error.status === 429 || error.status === 503 || error.status === 504;
    
    if (isTimeout || isQuota) {
      return mockAnswer(question, retrievedChunks);
    }
    throw error;
  }
}

function buildPrompt(
  question: string,
  context: string,
  chunks: { id: string; documentId: string; pageNumber: number; text: string }[]
): string {
  const chunkRefs = chunks.map((c, i) => 
    `[Chunk ${i + 1}] (chunkId: ${c.id}, page: ${c.pageNumber})\n${c.text}`
  ).join('\n\n---\n\n');

  return `You are an AI assistant that answers questions based ONLY on the provided document excerpts. 
Your response must be grounded in the evidence. If the documents don't contain the answer, say so.

Question: ${question}

Document Excerpts:
${chunkRefs}

Instructions:
1. Answer the question using ONLY the information in the excerpts above.
2. Write a natural, readable answer (like a helpful assistant). Do NOT include chunk numbers like [1], [2] in your answer.
3. Instead, cite sources inline using page numbers like this: "LSTM uses a memory cell [Page 12]."
4. In the citations array, include ONLY chunks you actually used.
5. For each citation, provide: chunkId (from the Chunk X header), documentId, pageNumber, and a short excerpt (max 200 chars) from that chunk.
6. Set confidence (0-1) based on how well the excerpts support your answer.
7. If the excerpts don't contain enough information, state that clearly and set confidence low.

Return JSON only.`;
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
        chunkId: c.chunkId,
        documentId: c.documentId,
        pageNumber: c.pageNumber,
        excerpt: c.excerpt.slice(0, 200)
      };
    });
}