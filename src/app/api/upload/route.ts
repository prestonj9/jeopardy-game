import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/pdf-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "application/pdf",
      "text/plain",
    ];
    const validExtensions = [".pdf", ".txt"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
      return NextResponse.json(
        { error: "Only .pdf and .txt files are accepted" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be 10MB or smaller" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || (ext === ".pdf" ? "application/pdf" : "text/plain");
    const content = await extractText(buffer, mimeType);

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Upload error:", err);
    const message =
      err instanceof Error ? err.message : "File processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
