import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { answers, status, taskContext, taskTips, taskRubric, questions } = body;

        // Verify ownership
        const document = await prisma.document.findFirst({
            where: {
                id,
                project: { ownerId: session.user.id },
            },
        });

        if (!document) {
            return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        if (answers !== undefined) {
            updateData.answersJson = JSON.stringify(answers);
        }

        if (questions !== undefined) {
            updateData.questionsJson = JSON.stringify(questions);
        }

        if (status !== undefined) {
            updateData.status = status;
        }

        if (taskContext !== undefined) updateData.taskContext = taskContext;
        if (taskTips !== undefined) updateData.taskTips = taskTips;
        if (taskRubric !== undefined) updateData.taskRubric = taskRubric;
        if (body.attachments !== undefined) {
            updateData.attachmentsJson = JSON.stringify(body.attachments);
        }

        // Update document
        const updated = await prisma.document.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            id: updated.id,
            status: updated.status,
            updatedAt: updated.updatedAt,
        });
    } catch (error) {
        console.error("Update document error:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;

        const document = await prisma.document.findFirst({
            where: {
                id,
                project: { ownerId: session.user.id },
            },
        });

        if (!document) {
            return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
        }

        return NextResponse.json({
            id: document.id,
            templateType: document.templateType,
            subject: document.subject,
            topic: document.topic,
            sourceText: document.sourceText,
            questions: JSON.parse(document.questionsJson),
            answers: JSON.parse(document.answersJson),
            status: document.status,
            updatedAt: document.updatedAt,
            taskContext: document.taskContext,
            taskTips: document.taskTips,
            taskRubric: document.taskRubric,
            attachments: document.attachmentsJson ? JSON.parse(document.attachmentsJson) : [],
        });
    } catch (error) {
        console.error("Get document error:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
