import { NextRequest, NextResponse } from "next/server";
// @ts-ignore
import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
// @ts-ignore
const Tesseract = require("tesseract.js");

// Question detection patterns
const HEADER_PATTERNS = [
    /^\s*\(?RA\d+_[a-z]\)?/i,           // "RA04_a"
    /^\s*\(?RA\s*\d+/i,                 // "(RA4", "RA4", "(RA 04" - Broader RA pattern
    /^\s*R\.?A\.?\s*\d+/i,              // "R.A. 4"
    /^\s*Actividad\s+\d+/i,             // "Actividad 1"
    /^\s*Pregunta\s*\d+/i,              // "Pregunta 1"
    /^\s*PARTE\s+\w+/i,                 // "PARTE A"
    /^\s*\d+[\.\)]\s+/                  // "1. ", "2) "
];

function detectQuestions(text: string): string[] {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const questions: string[] = [];
    let currentQuestion = "";

    for (const line of lines) {
        let isHeader = false;

        // Check if line is a new question header
        for (const pattern of HEADER_PATTERNS) {
            if (pattern.test(line)) {
                // If we were building a question, push it now
                if (currentQuestion) {
                    questions.push(currentQuestion.trim());
                }
                // Start new question
                currentQuestion = line;
                isHeader = true;
                break;
            }
        }

        // If not a header, append to current question (if we have one started)
        if (!isHeader) {
            if (currentQuestion) {
                currentQuestion += "\n" + line;
            }
        }
    }

    // Push the last question
    if (currentQuestion) {
        questions.push(currentQuestion.trim());
    }

    return questions;
}

export async function POST(request: NextRequest) {
    try {
        let text = "";
        const contentType = request.headers.get("content-type") || "";

        // BRANCH 1: Raw Text via JSON
        if (contentType.includes("application/json")) {
            const body = await request.json();
            text = body.text || "";
            if (text.trim().length < 20) {
                return NextResponse.json({ error: "El texto es demasiado corto (mínimo 20 caracteres)." }, { status: 400 });
            }
        }
        // BRANCH 2: File Upload via FormData
        else {
            let formData;
            try {
                formData = await request.formData();
            } catch (parseError) {
                console.error("Error parsing FormData:", parseError);
                return NextResponse.json(
                    { error: "Error al leer el archivo. Asegúrese de que es un archivo válido." },
                    { status: 400 }
                );
            }

            const file = formData.get("file") as File | null;

            if (!file) {
                return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = file.name.toLowerCase();

            // Parse based on file type
            if (fileName.endsWith(".pdf")) {
                try {
                    console.log("Parsing PDF with pdf-parse v2...");
                    const parser = new PDFParse({ data: new Uint8Array(buffer) });
                    const result = await parser.getText();
                    text = result.text;
                    await parser.destroy();

                    if (!text || text.trim().length < 50) {
                        console.log("PDF text empty/short. Check for OCR needs.");
                        if (text.trim().length < 10) {
                            text += "\n[AVISO: No se detectó texto seleccionable.]";
                        }
                    }
                } catch (pdfError) {
                    console.error("PDF parse error:", pdfError);
                    throw new Error("Error al leer el PDF: " + (pdfError instanceof Error ? pdfError.message : String(pdfError)));
                }
            } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
                try {
                    const result = await mammoth.extractRawText({ buffer });
                    text = result.value;
                } catch (docError) {
                    console.error("DOCX parse error:", docError);
                    throw new Error("Error al procesar el documento Word.");
                }
            } else if (/\.(png|jpg|jpeg|bmp|webp)$/.test(fileName)) {
                try {
                    console.log("Performing OCR on image...");
                    const { data: { text: ocrText } } = await Tesseract.recognize(
                        buffer,
                        'eng+spa',
                        { logger: (m: any) => console.log(m) }
                    );
                    text = ocrText;
                } catch (ocrError) {
                    console.error("OCR error:", ocrError);
                    throw new Error("Error al realizar OCR en la imagen.");
                }
            } else if (fileName.endsWith(".txt")) {
                text = buffer.toString("utf-8");
            } else {
                return NextResponse.json({ error: "Formato no soportado. Usa PDF, DOCX, TXT o Imágenes." }, { status: 400 });
            }
        }

        // Validate final text
        if (!text || text.trim().length === 0) {
            return NextResponse.json({ error: "No se pudo extraer texto (archivo vacío o escaneado)." }, { status: 400 });
        }

        // Detect questions
        const questions = detectQuestions(text);

        return NextResponse.json({
            text: text.slice(0, 500000), // Limit text size (500k chars ~ 100-200 pages)
            questions,
        });

    } catch (error) {
        console.error("Parse API Error:", error);
        const msg = error instanceof Error ? error.message : "Error interno desconocido";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
