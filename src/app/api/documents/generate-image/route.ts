
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: "Falta el prompt" }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: "API Key no configurada" }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        console.log("Generando imagen para prompt:", prompt.slice(0, 50) + "...");

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `Ilustración educativa clara y profesional sobre: ${prompt}. Estilo limpio, académico, sin texto.`,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
        });

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) {
            throw new Error("No se recibió imagen");
        }

        // Save to public/uploads
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
        const filePath = path.join(uploadsDir, fileName);

        const buffer = Buffer.from(b64, "base64");
        fs.writeFileSync(filePath, buffer);

        const publicUrl = `/uploads/${fileName}`;

        return NextResponse.json({ url: publicUrl });

    } catch (error: any) {
        console.error("Image Gen Error:", error);
        return NextResponse.json({ error: error.message || "Error al generar imagen" }, { status: 500 });
    }
}
