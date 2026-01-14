import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await request.json();
        const { templateType, sourceText, questions, subject, topic } = body;

        if (!sourceText || !Array.isArray(questions)) {
            return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
        }

        // Note: subject/topic are now requested at export time, not upload time

        // Get or create default project for user
        let project = await prisma.project.findFirst({
            where: { ownerId: session.user.id },
            orderBy: { createdAt: "desc" },
        });

        if (!project) {
            project = await prisma.project.create({
                data: {
                    name: "Mi Proyecto",
                    ownerId: session.user.id,
                },
            });
        }

        // Initialize answers object
        let answersObj: Record<number, string> = {};
        questions.forEach((_: string, index: number) => {
            answersObj[index] = "";
        });

        // Initialize extra fields
        let taskContext = "";
        let taskTips = "";
        let taskRubric = "";

        // Generate AI Answers using Google Gemini
        if (process.env.GOOGLE_API_KEY && questions.length > 0) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-pro-latest" });

                const prompt = `
                    Eres un asistente experto educativo. Tu tarea es analizar el siguiente documento (enunciado de tarea) y:
                    1. Identificar las preguntas o enunciados de la tarea.
                    2. Generar las respuestas a esas preguntas.

                    Texto:
                    "${sourceText.slice(0, 30000)}..."
                    
                    Instrucciones:
                    - Devuelve un ÚNICO objeto JSON con este formato exacto:
                    {
                        "answers": {
                            "0": "Respuesta pregunta 1...",
                            "1": "Respuesta pregunta 2..."
                        }
                    }
                    - NO markdown.
                `;

                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                });

                const response = result.response;
                let text = response.text();

                text = text.replace(/```json/g, "").replace(/```/g, "").trim();

                if (text) {
                    try {
                        const aiData = JSON.parse(text);

                        // Extract answers
                        const aiAnswers = aiData.answers || {};
                        Object.keys(aiAnswers).forEach((key) => {
                            const index = parseInt(key);
                            if (!isNaN(index) && index < questions.length) {
                                answersObj[index] = aiAnswers[key] || aiAnswers[index.toString()];
                            }
                        });
                    } catch (e) {
                        console.error("Error parsing AI JSON:", e);
                    }
                }

                // Update document creation with new fields (Empty by default)
                const document = await prisma.document.create({
                    data: {
                        projectId: project.id,
                        templateType: templateType || "FOC",
                        subject: subject || null,
                        topic: topic || null,
                        sourceText,
                        taskContext: "",
                        taskTips: "",
                        taskRubric: "",
                        questionsJson: JSON.stringify(questions),
                        answersJson: JSON.stringify(answersObj),
                        status: "draft",
                    },
                });

                return NextResponse.json({
                    id: document.id,
                    templateType: document.templateType,
                    questions,
                });

            } catch (aiError) {
                console.error("Gemini Generation Error:", aiError);
                // Fallback creation if AI fails
                const document = await prisma.document.create({
                    data: {
                        projectId: project.id,
                        templateType: templateType || "FOC",
                        subject: subject || null,
                        topic: topic || null,
                        sourceText,
                        questionsJson: JSON.stringify(questions),
                        answersJson: JSON.stringify(answersObj),
                        status: "draft",
                    },
                });
                return NextResponse.json({ id: document.id, questions });
            }
        } else {
            // Case: No API Key or No Questions (Create without AI)
            const document = await prisma.document.create({
                data: {
                    projectId: project.id,
                    templateType: templateType || "FOC",
                    subject: subject || null,
                    topic: topic || null,
                    sourceText,
                    questionsJson: JSON.stringify(questions),
                    answersJson: JSON.stringify(answersObj),
                    status: "draft",
                },
            });
            return NextResponse.json({ id: document.id, questions });
        }
    } catch (error) {
        console.error("Create document error:", error);
        return NextResponse.json({ error: "Error interno al crear el documento" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (id) {
            // Get single document
            const document = await prisma.document.findFirst({
                where: {
                    id,
                    project: { ownerId: session.user.id },
                },
                include: { project: true },
            });

            if (!document) {
                return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
            }

            return NextResponse.json({
                id: document.id,
                templateType: document.templateType,
                sourceText: document.sourceText,
                questions: JSON.parse(document.questionsJson),
                answers: JSON.parse(document.answersJson),
                status: document.status,
                updatedAt: document.updatedAt,
                taskContext: document.taskContext,
                taskTips: document.taskTips,
                taskRubric: document.taskRubric,
            });
        }

        // List all documents
        const documents = await prisma.document.findMany({
            where: { project: { ownerId: session.user.id } },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                templateType: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json(documents);
    } catch (error) {
        console.error("Get documents error:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
