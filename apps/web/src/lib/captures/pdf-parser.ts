const MAX_PDF_TEXT_LENGTH = 80_000;

export type PdfParseResult = {
  content: string;
  pageCount: number;
  extractedPageCount: number;
  truncated: boolean;
};

export async function parsePdfFile(file: File): Promise<PdfParseResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const sections: string[] = [];
  let extractedPageCount = 0;
  let totalLength = 0;
  let truncated = false;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!pageText) continue;

    const section = `## 第 ${pageNumber} 页\n\n${pageText}`;
    if (totalLength + section.length > MAX_PDF_TEXT_LENGTH) {
      const remaining = MAX_PDF_TEXT_LENGTH - totalLength;
      if (remaining > 100) sections.push(section.slice(0, remaining));
      truncated = true;
      break;
    }

    sections.push(section);
    totalLength += section.length;
    extractedPageCount += 1;
  }

  return {
    content: sections.join("\n\n"),
    pageCount: document.numPages,
    extractedPageCount,
    truncated,
  };
}
