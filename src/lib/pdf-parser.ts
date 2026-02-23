import { PDFParse } from "pdf-parse";

export async function extractText(
  file: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const parser = new PDFParse(file);
      const result = await parser.getText();
      const text = result.text || "";
      if (text.trim().length < 50) {
        throw new Error(
          "PDF appears to be a scanned image with no extractable text."
        );
      }
      return text.slice(0, 50000);
    } catch (e) {
      if (e instanceof Error && e.message.includes("scanned image")) {
        throw e;
      }
      throw new Error(
        "Could not extract text from this PDF. Please try a text-based PDF or paste the content as plain text."
      );
    }
  }

  // Plain text file
  return file.toString("utf-8").slice(0, 50000);
}
