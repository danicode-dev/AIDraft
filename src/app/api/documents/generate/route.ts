import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Groq from "groq-sdk";

// Build the prompt used by both models
function buildPrompt(question: string, contextText: string, sourceText: string): string {
    return `
ROL: Profesor universitario experto. Responde preguntas de alumnos.

${contextText ? `CONTEXTO ADICIONAL:\n${contextText}` : ""}

${sourceText ? `DOCUMENTO DE REFERENCIA:\n${sourceText}` : ""}

PREGUNTA:
"${question}"

INSTRUCCIONES:

1) PRIORIDAD DE FUENTES:
   - Si hay CONTEXTO ADICIONAL o DOCUMENTO con contenido útil, ÚSALOS como base principal.
   - Si el documento está vacío, solo tiene un título, o no es relevante para la pregunta, responde usando tu CONOCIMIENTO GENERAL.
   - En ese caso, empieza tu respuesta con: "Basándome en conocimiento general:"

2) ESTRUCTURA DE RESPUESTA:
   
   RESPUESTA:
   [2-4 frases directas respondiendo la pregunta]
   
   DESARROLLO (opcional):
   [Explicación más detallada si es útil, máximo 5-8 líneas]
   
   EJEMPLO (opcional):
   [Solo si aplica a código o procedimiento técnico]

3) FORMATO OBLIGATORIO:
   - PROHIBIDO usar asteriscos (*) para NADA
   - PROHIBIDO usar almohadillas (#) para títulos
   - PROHIBIDO markdown de ningún tipo
   - Usa MAYÚSCULAS para títulos de sección (RESPUESTA:, DESARROLLO:, EJEMPLO:)
   - Usa guiones (-) o números (1. 2. 3.) para listas
   - Sé CONCISO pero ÚTIL. Responde siempre algo práctico.
    `;
}

// Try Gemini with automatic retry
async function tryGemini(prompt: string, retryCount = 0): Promise<{ success: boolean; answer?: string; error?: string; shouldFallback?: boolean }> {
    if (!process.env.GOOGLE_API_KEY) {
        return { success: false, error: "No GOOGLE_API_KEY", shouldFallback: true };
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 3000
            },
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const answer = result.response.text();

        if (!answer || answer.trim().length === 0) {
            return { success: false, error: "Empty response", shouldFallback: true };
        }

        console.log("✓ Gemini generated answer successfully");
        return { success: true, answer };
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error("Gemini error:", msg);

        // Check if we should wait and retry (extract wait time from error)
        if (msg.includes("429") && retryCount < 2) {
            // Try to extract retry delay from error message
            const retryMatch = msg.match(/retry in (\d+)/i) || msg.match(/retryDelay.*?(\d+)/i);
            const waitSeconds = retryMatch ? parseInt(retryMatch[1]) : 60;

            console.log(`Rate limited. Waiting ${waitSeconds} seconds before retry...`);
            await new Promise(r => setTimeout(r, waitSeconds * 1000));

            return tryGemini(prompt, retryCount + 1);
        }

        // Determine if we should fallback
        const shouldFallback = msg.includes("429") || msg.includes("Quota") || msg.includes("limit") || msg.includes("404");
        return { success: false, error: msg, shouldFallback };
    }
}

// Fallback to OpenAI
async function tryOpenAI(prompt: string): Promise<{ success: boolean; answer?: string; error?: string }> {
    if (!process.env.OPENAI_API_KEY) {
        return { success: false, error: "No OPENAI_API_KEY configured" };
    }

    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fast and cheap
            messages: [
                { role: "system", content: "Eres un profesor universitario experto que responde preguntas de alumnos de forma clara y concisa." },
                { role: "user", content: prompt }
            ],
            temperature: 0.5,
            max_tokens: 2000,
        });

        const answer = completion.choices[0]?.message?.content;

        if (!answer || answer.trim().length === 0) {
            return { success: false, error: "Empty response from OpenAI" };
        }

        console.log("✓ OpenAI (fallback) generated answer successfully");
        return { success: true, answer };
    } catch (error: any) {
        console.error("OpenAI error:", error?.message || error);
        return { success: false, error: error?.message || String(error) };
    }
}

// Fallback to Groq (FREE tier with good limits)
async function tryGroq(prompt: string): Promise<{ success: boolean; answer?: string; error?: string }> {
    if (!process.env.GROQ_API_KEY) {
        return { success: false, error: "No GROQ_API_KEY configured" };
    }

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile", // Fast and free
            messages: [
                { role: "system", content: "Eres un profesor universitario experto que responde preguntas de alumnos de forma clara y concisa. NO uses asteriscos ni markdown." },
                { role: "user", content: prompt }
            ],
            temperature: 0.5,
            max_tokens: 2000,
        });

        const answer = completion.choices[0]?.message?.content;

        if (!answer || answer.trim().length === 0) {
            return { success: false, error: "Empty response from Groq" };
        }

        console.log("✓ Groq generated answer successfully");
        return { success: true, answer };
    } catch (error: any) {
        console.error("Groq error:", error?.message || error);
        return { success: false, error: error?.message || String(error) };
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { documentId, questionIndex } = await request.json();

        if (!documentId || questionIndex === undefined) {
            return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
        }

        // Get document
        const document = await prisma.document.findFirst({
            where: {
                id: documentId,
                project: { ownerId: session.user.id },
            },
        });

        if (!document) {
            return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
        }

        const questions: string[] = JSON.parse(document.questionsJson);
        const question = questions[questionIndex];

        if (!question) {
            return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
        }

        // Build prompt
        const contextText = document.taskContext
            ? `--- CONTEXTO PRIORITARIO ---\n${document.taskContext}\n--------------------------\n`
            : "";
        const sourceText = `--- DOCUMENTO DE REFERENCIA ---\n${document.sourceText.slice(0, 35000)}`;
        const prompt = buildPrompt(question, contextText, sourceText);

        console.log(`Generating answer for Doc ${documentId}, Question ${questionIndex}...`);

        // STRATEGY: Try Groq first (FREE and reliable), then Gemini, then OpenAI (paid)

        // 1. TRY GROQ FIRST (most reliable free option)
        console.log("Trying Groq (primary)...");
        const groqResult = await tryGroq(prompt);

        if (groqResult.success && groqResult.answer) {
            return NextResponse.json({ answer: groqResult.answer, provider: "groq" });
        }

        // 2. If Groq failed, try Gemini
        console.log("Groq failed, trying Gemini fallback...");
        const geminiResult = await tryGemini(prompt);

        if (geminiResult.success && geminiResult.answer) {
            return NextResponse.json({ answer: geminiResult.answer, provider: "gemini" });
        }

        // 3. If Gemini also failed, try OpenAI as last resort
        console.log("Gemini failed, trying OpenAI fallback...");
        const openaiResult = await tryOpenAI(prompt);

        if (openaiResult.success && openaiResult.answer) {
            return NextResponse.json({ answer: openaiResult.answer, provider: "openai" });
        }

        // All failed - return error with details
        return NextResponse.json({
            error: `Todas las APIs fallaron. Groq: ${groqResult.error}. Gemini: ${geminiResult.error}. OpenAI: ${openaiResult.error}`
        }, { status: 500 });

    } catch (error) {
        console.error("AI Route Internal Error:", error);
        return NextResponse.json({ error: "Error interno al generar la respuesta" }, { status: 500 });
    }
}
