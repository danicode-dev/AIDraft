"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Status = "pending" | "review" | "complete";

interface QuestionCard {
    question: string;
    answer: string;
    status: Status;
}

interface Attachment {
    name: string;
    type: string;
    size: number;
}

function EditorContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const documentId = searchParams.get("id");

    const [cards, setCards] = useState<QuestionCard[]>([]);
    const [templateType, setTemplateType] = useState<string>("FOC");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isUploadingContext, setIsUploadingContext] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [taskContext, setTaskContext] = useState("");
    const [taskTips, setTaskTips] = useState("");
    const [taskRubric, setTaskRubric] = useState("");
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [activeTab, setActiveTab] = useState<"questions" | "info">("questions");

    // Load document
    useEffect(() => {
        if (!documentId) {
            router.push("/app/upload");
            return;
        }

        const loadDocument = async () => {
            try {
                const res = await fetch(`/api/documents/${documentId}`);
                if (!res.ok) {
                    throw new Error("Documento no encontrado");
                }
                const data = await res.json();

                const questions: string[] = data.questions || [];
                const answers: Record<number, string> = data.answers || {};

                setCards(
                    questions.map((q: string, i: number) => ({
                        question: q,
                        answer: answers[i] || "",
                        status: answers[i] ? (answers[i].length > 50 ? "complete" : "review") : "pending",
                    }))
                );

                setTaskContext(data.taskContext || "");
                setTaskTips(data.taskTips || "");
                setTaskRubric(data.taskRubric || "");

                setTaskContext(data.taskContext || "");
                setTaskTips(data.taskTips || "");
                setTaskRubric(data.taskRubric || "");
                setAttachments(data.attachments || []);

                setTemplateType(data.templateType || "FOC");
                setIsLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error al cargar");
                setIsLoading(false);
            }
        };

        loadDocument();
    }, [documentId, router]);

    // Autosave Answers (debounced)
    const saveAnswers = useCallback(async (updatedCards: QuestionCard[]) => {
        if (!documentId) return;

        setIsSaving(true);
        try {
            const answers: Record<number, string> = {};
            updatedCards.forEach((card, i) => {
                answers[i] = card.answer;
            });

            await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers }),
            });
            setLastSaved(new Date());
        } catch (err) {
            console.error("Save error:", err);
        } finally {
            setIsSaving(false);
        }
    }, [documentId]);

    // Save Metadata (context, tips, rubric)
    const saveMetadata = useCallback(async () => {
        if (!documentId) return;
        setIsSaving(true);
        try {
            await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    taskContext,
                    taskTips,
                    taskRubric,
                    attachments
                }),
            });
            setLastSaved(new Date());
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    }, [documentId, taskContext, taskTips, taskRubric, attachments]);

    // Debounced autosave for cards
    useEffect(() => {
        if (cards.length === 0 || isLoading) return;
        const timer = setTimeout(() => { saveAnswers(cards); }, 1500);
        return () => clearTimeout(timer);
    }, [cards, saveAnswers, isLoading]);

    // Debounced autosave for metadata
    useEffect(() => {
        if (isLoading) return;
        const timer = setTimeout(() => { saveMetadata(); }, 2000);
        return () => clearTimeout(timer);
    }, [taskContext, taskTips, taskRubric, attachments, saveMetadata, isLoading]);


    const updateCard = (index: number, updates: Partial<QuestionCard>) => {
        setCards((prev) =>
            prev.map((card, i) => (i === index ? { ...card, ...updates } : card))
        );
    };

    const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0 });

    const askAI = async (index: number) => {
        setGeneratingIndex(index);
        try {
            const res = await fetch("/api/documents/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    documentId,
                    questionIndex: index
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al generar");
            }

            const data = await res.json();
            updateCard(index, { answer: data.answer, status: "review" });
        } catch (err) {
            alert(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setGeneratingIndex(null);
        }
    };

    // Generate all answers sequentially
    const generateAll = async () => {
        if (isGeneratingAll) return;

        const pendingCards = cards.map((card, idx) => ({ card, idx })).filter(c => c.card.status === "pending" || c.card.answer.trim().length < 20);

        if (pendingCards.length === 0) {
            alert("Todas las preguntas ya tienen respuesta.");
            return;
        }

        setIsGeneratingAll(true);
        setGeneratingProgress({ current: 0, total: pendingCards.length });

        for (let i = 0; i < pendingCards.length; i++) {
            const { idx } = pendingCards[i];
            setGeneratingProgress({ current: i + 1, total: pendingCards.length });
            setGeneratingIndex(idx);

            try {
                const res = await fetch("/api/documents/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        documentId,
                        questionIndex: idx
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    updateCard(idx, { answer: data.answer, status: "review" });
                } else {
                    // Log error but continue with next question
                    const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                    console.error(`Failed to generate answer for question ${idx}:`, errorData.error);
                }
            } catch (err) {
                console.error(`Error generating answer for question ${idx}:`, err);
            }

            // Short delay between requests (2 seconds - Groq allows 30 req/min)
            if (i < pendingCards.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        setGeneratingIndex(null);
        setIsGeneratingAll(false);
        setGeneratingProgress({ current: 0, total: 0 });
    };

    const handleContextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation: Max size 15MB
        if (file.size > 15 * 1024 * 1024) {
            alert("El archivo es demasiado grande (Máx 15MB). Pruebe a comprimirlo o dividirlo.");
            return;
        }

        const validTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
            "application/msword", // doc
            "text/plain",
            "image/png",
            "image/jpeg",
            "image/jpg"
        ];
        // Allow if type is empty (sometimes happens) or matches list
        if (file.type && !validTypes.includes(file.type)) {
            // Check extension just in case
            if (!/\.(pdf|docx|doc|txt|png|jpg|jpeg)$/i.test(file.name)) {
                alert("Tipo de archivo no soportado. Use PDF, DOCX, TXT o Imágenes.");
                return;
            }
        }

        setIsUploadingContext(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            // IMPORTANT: Do NOT set Content-Type header manually. Browser sets boundary.
            const res = await fetch("/api/parse", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Error ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            const text = data.text || "";

            setTaskContext((prev) => {
                const separator = prev ? "\n\n--- CONTENIDO DEL ARCHIVO ADJUNTO ---\n\n" : "";
                return prev + separator + text;
            });

            // Add to persistent attachments list
            const newAttachment: Attachment = {
                name: file.name,
                type: file.type || "unknown",
                size: file.size
            };
            setAttachments(prev => [...prev, newAttachment]);

            // Clear input
            if (fileInputRef.current) fileInputRef.current.value = "";

        } catch (err) {
            alert(err instanceof Error ? err.message : "Error al subir archivo");
        } finally {
            setIsUploadingContext(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-[#004785] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-12 text-center">
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <Link href="/app/upload" className="text-[#004785] hover:underline">
                    Volver a subir archivo
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 pb-36">

            {/* Header / Info */}
            <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 px-1 mb-6">
                <span>{lastSaved ? `Guardado: ${lastSaved.toLocaleTimeString()}` : "Cambios sin guardar"}</span>
                {isSaving && <span className="animate-pulse text-[#004785]">Guardando...</span>}
            </div>

            {/* TABS NAVIGATION */}
            <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6">
                <button
                    onClick={() => setActiveTab("questions")}
                    className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === "questions"
                        ? "border-[#004785] text-[#004785] dark:text-blue-400 dark:border-blue-400"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                >
                    Preguntas
                </button>
                <button
                    onClick={() => setActiveTab("info")}
                    className={`pb-3 px-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === "info"
                        ? "border-[#004785] text-[#004785] dark:text-blue-400 dark:border-blue-400"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                >
                    Contexto IA
                </button>
            </div>

            <div className="space-y-6">
                {/* TAB: QUESTIONS */}
                {activeTab === "questions" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-[#004785] dark:text-blue-400">Preguntas detectadas</h2>
                            <button
                                onClick={generateAll}
                                disabled={isGeneratingAll || generatingIndex !== null}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGeneratingAll ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Generando {generatingProgress.current}/{generatingProgress.total}...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Generar Todas
                                    </>
                                )}
                            </button>
                        </div>
                        {cards.map((card, index) => (
                            <article
                                key={index}
                                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
                            >
                                {/* Header */}
                                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-start gap-4">
                                    <h3 className="font-semibold text-[#004785] dark:text-blue-400 leading-tight text-sm whitespace-pre-wrap">
                                        {card.question}
                                    </h3>
                                    <select
                                        value={card.status}
                                        onChange={(e) => updateCard(index, { status: e.target.value as Status })}
                                        className="text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer bg-transparent"
                                    >
                                        <option value="pending">Pendiente</option>
                                        <option value="review">Revisar</option>
                                        <option value="complete">Completado</option>
                                    </select>
                                </div>

                                {/* Body */}
                                <div className="p-4">
                                    <textarea
                                        value={card.answer}
                                        onChange={(e) => updateCard(index, {
                                            answer: e.target.value,
                                            status: e.target.value.length > 50 ? "complete" : e.target.value.length > 0 ? "review" : "pending"
                                        })}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#004785] focus:border-transparent transition-all text-gray-800 dark:text-gray-200 resize-y min-h-[120px]"
                                        placeholder="Escribe tu respuesta aquí..."
                                        spellCheck={false}
                                    />

                                    <div className="mt-4 flex gap-2 justify-end">
                                        <button
                                            onClick={() => updateCard(index, { answer: "", status: "pending" })}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            onClick={() => askAI(index)}
                                            disabled={generatingIndex === index}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {generatingIndex === index ? "Generando..." : "Preguntar a IA"}
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {/* TAB: CONTEXT */}
                {activeTab === "info" && (
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="font-bold text-[#004785] dark:text-blue-400 mb-2 flex items-center gap-2 text-lg">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Contexto para IA
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 ml-2">
                                    No se exporta al Docx final
                                </span>
                            </h3>
                            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                                Este apartado sirve para que pegues aquí toda la información teórica, fórmulas o apuntes que la Inteligencia Artificial deba "leer" antes de responder a tus preguntas. <br />
                                <strong>Lo que escribas aquí NO aparecerá en tu documento final.</strong>
                            </p>

                            <div className="mb-4">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleContextFileUpload}
                                    accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingContext}
                                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    {isUploadingContext ? (
                                        <>
                                            <div className="animate-spin h-4 w-4 border-2 border-[#004785] border-t-transparent rounded-full"></div>
                                            Leyendo archivo...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            Adjuntar PDF / DOCX / IMG
                                        </>
                                    )}
                                </button>
                                <p className="text-xs text-gray-400 mt-1.5 ml-1">
                                    Se extraerá el texto y se añadirá al final del campo de texto.
                                </p>
                            </div>

                            {/* ATTACHMENTS LIST */}
                            {attachments.length > 0 && (
                                <div className="mb-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                                    {attachments.map((att, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                                            {/* Icon placeholder based on type */}
                                            <span className="text-xs font-bold text-slate-500 uppercase">
                                                {att.name.split('.').pop()?.slice(0, 3) || "FILE"}
                                            </span>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200 max-w-[150px] truncate" title={att.name}>
                                                {att.name}
                                            </span>
                                            {/* Remove button */}
                                            <button
                                                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                                className="ml-1 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <textarea
                                value={taskContext}
                                onChange={(e) => setTaskContext(e.target.value)}
                                className="w-full h-[500px] bg-sky-50 dark:bg-slate-900 border border-sky-100 dark:border-slate-600 rounded-lg p-4 text-base focus:ring-2 focus:ring-[#004785] focus:border-transparent resize-y"
                                placeholder="Pega aquí el temario, apuntes o contexto..."
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 shadow-lg z-50">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button
                        onClick={() => { saveAnswers(cards); saveMetadata(); }}
                        disabled={isSaving}
                        className="flex-1 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-slate-200 dark:border-slate-600 font-semibold py-3.5 px-4 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        {isSaving ? "Guardando..." : "Guardar Todo"}
                    </button>
                    <Link
                        href={`/app/preview?id=${documentId}`}
                        className="flex-[2] bg-[#004785] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Previsualizar
                    </Link>
                </div>
            </div>
        </div >
    );
}


export default function EditorPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-[#004785] border-t-transparent rounded-full"></div>
            </div>
        }>
            <EditorContent />
        </Suspense>
    );
}
