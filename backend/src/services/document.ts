import { PDFParse } from 'pdf-parse';

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<{ pageNumber: number; text: string }[]> {
  if (mimeType === 'application/pdf') {
    return extractFromPdf(buffer);
  }
  if (mimeType === 'text/plain') {
    return extractFromTxt(buffer);
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}

function extractFromTxt(buffer: Buffer): { pageNumber: number; text: string }[] {
  const fullText = buffer.toString('utf-8');
  if (!fullText.trim()) {
    throw new Error('Text file is empty');
  }

  const PAGE_CHAR_LIMIT = 3000;
  const pages: { pageNumber: number; text: string }[] = [];

  for (let i = 0; i < fullText.length; i += PAGE_CHAR_LIMIT) {
    const chunk = fullText.slice(i, i + PAGE_CHAR_LIMIT);
    pages.push({
      pageNumber: pages.length + 1,
      text: chunk.trim()
    });
  }

  return pages;
}

async function extractFromPdf(buffer: Buffer): Promise<{ pageNumber: number; text: string }[]> {
  let parser: PDFParse;
  try {
    parser = new PDFParse({ data: buffer });
  } catch (err) {
    throw new Error(`Failed to initialize PDF parser: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  let textResult;
  try {
    textResult = await parser.getText();
  } catch (err) {
    throw new Error(`Failed to parse PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    await parser.destroy();
  }

  const { pages, total } = textResult;
  if (!pages || pages.length === 0) {
    throw new Error('PDF contains no extractable text');
  }

  return pages.map((page: { num: number; text: string }) => ({
    pageNumber: page.num,
    text: page.text.trim()
  }));
}