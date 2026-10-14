import PDFParser from 'pdf2json';

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

function extractFromPdf(buffer: Buffer): Promise<{ pageNumber: number; text: string }[]> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
      const error = 'parserError' in errData ? errData.parserError : errData;
      reject(new Error(`Failed to parse PDF: ${error.message}`));
    });

    parser.on('pdfParser_dataReady', (pdfData: {
      Pages: Array<{
        Texts: Array<{
          R: Array<{ T: string }>;
        }>;
      }>;
    }) => {
      try {
        const pages = pdfData.Pages.map((page, index) => {
          const text = page.Texts.map(t =>
            decodeURIComponent(t.R.map(r => r.T).join(''))
          ).join(' ');
          return {
            pageNumber: index + 1,
            text: text.trim()
          };
        });

        if (pages.length === 0 || pages.every(p => !p.text)) {
          reject(new Error('PDF contains no extractable text'));
          return;
        }

        resolve(pages);
      } catch (err) {
        reject(new Error(`Failed to extract text from PDF: ${err instanceof Error ? err.message : 'Unknown error'}`));
      }
    });

    parser.parseBuffer(buffer);
  });
}