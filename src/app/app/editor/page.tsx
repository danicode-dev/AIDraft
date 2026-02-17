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

type Tab = "questions" | "context" | "settings";

// Helper: extract RA code from question text
function extractRA(question: string): string | null {
    const match1 = question.match(/\(?(RA\d+_[a-z])\)?/i);
    if (match1) return match1[1].toUpperCase();
    const match2 = question.match(/(R\.?A\.?\s*\d+[\._]\w+)/i);
    if (match2) return match2[1].replace(/[\.\s]/g, "").toUpperCase();
    return null;
}

// Helper: short label from question
function shortLabel(question: string, maxLen = 30): string {
    // Remove RA prefix pattern for display
    const cleaned = question.replace(/^\(?(RA\d+_[a-z])\)?\s*[-–:.]?\s*/i, "").trim();
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.substring(0, maxLen) + "...";
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
    const [activeTab, setActiveTab] = useState<Tab>("questions");
    const [expandedCard, setExpandedCard] = useState<number | null>(0);
    const [editingQuestion, setEditingQuestion] = useState<number | null>(null);

    // Structure panel
    const [showStructure, setShowStructure] = useState(true);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
            const questions: string[] = [];
            updatedCards.forEach((card, i) => {
                answers[i] = card.answer;
                questions.push(card.question);
            });

            await fetch(`/api/documents/${documentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers, questions }),
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
    const [isValidating, setIsValidating] = useState(false);

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

    // Validate all questions at once — marks all as complete and saves
    const validateAll = async () => {
        setIsValidating(true);
        const validated = cards.map(card => ({ ...card, status: "complete" as Status }));
        setCards(validated);
        await saveAnswers(validated);
        await saveMetadata();
        setIsValidating(false);
    };

    const handleContextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            alert("El archivo es demasiado grande (Max 15MB).");
            return;
        }

        const validTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "text/plain",
            "image/png",
            "image/jpeg",
            "image/jpg"
        ];
        if (file.type && !validTypes.includes(file.type)) {
            if (!/\.(pdf|docx|doc|txt|png|jpg|jpeg)$/i.test(file.name)) {
                alert("Tipo de archivo no soportado. Use PDF, DOCX, TXT o Imagenes.");
                return;
            }
        }

        setIsUploadingContext(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

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

            const newAttachment: Attachment = {
                name: file.name,
                type: file.type || "unknown",
                size: file.size
            };
            setAttachments(prev => [...prev, newAttachment]);

            if (fileInputRef.current) fileInputRef.current.value = "";

        } catch (err) {
            alert(err instanceof Error ? err.message : "Error al subir archivo");
        } finally {
            setIsUploadingContext(false);
        }
    };

    // Rich text formatting
    const applyFormat = (command: string) => {
        document.execCommand(command, false);
    };

    // Drag & drop reorder
    const handleDragStart = (index: number) => {
        setDragIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragEnd = () => {
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
            setCards(prev => {
                const newCards = [...prev];
                const [moved] = newCards.splice(dragIndex, 1);
                newCards.splice(dragOverIndex, 0, moved);
                return newCards;
            });
            // Update expanded card index if needed
            if (expandedCard === dragIndex) {
                setExpandedCard(dragOverIndex);
            } else if (expandedCard !== null) {
                if (dragIndex < expandedCard && dragOverIndex >= expandedCard) {
                    setExpandedCard(expandedCard - 1);
                } else if (dragIndex > expandedCard && dragOverIndex <= expandedCard) {
                    setExpandedCard(expandedCard + 1);
                }
            }
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    // Status badge color helper
    const statusColor = (status: Status) => {
        switch (status) {
            case "complete": return "bg-green-500";
            case "review": return "bg-yellow-400";
            default: return "bg-gray-300";
        }
    };

    const statusLabel = (status: Status) => {
        switch (status) {
            case "complete": return "Validado";
            case "review": return "En edicion";
            default: return "Sin resolver";
        }
    };

    const pendingCount = cards.filter(c => c.status === "pending").length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-12 text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Link href="/app/upload" className="text-[var(--primary)] hover:underline">
                    Volver a subir archivo
                </Link>
            </div>
        );
    }

    return (
        <div className="flex h-full overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-[var(--border-subtle)] flex flex-col pt-6 shrink-0">
                <div className="px-6 mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Workspace</span>
                </div>
                <nav className="px-4 space-y-1">
                    <button
                        onClick={() => setActiveTab("questions")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${activeTab === "questions"
                            ? "bg-[var(--background-app)] text-[var(--primary)] font-semibold shadow-sm border border-gray-200"
                            : "text-[var(--text-subtle)] hover:bg-[var(--background-app)] hover:text-[var(--primary)]"
                            }`}
                    >
                        <span className={`material-symbols-outlined text-[20px] ${activeTab === "questions" ? "filled-icon" : ""}`}>quiz</span>
                        Editor de Preguntas
                    </button>
                    <button
                        onClick={() => setActiveTab("context")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${activeTab === "context"
                            ? "bg-[var(--background-app)] text-[var(--primary)] font-semibold shadow-sm border border-gray-200"
                            : "text-[var(--text-subtle)] hover:bg-[var(--background-app)] hover:text-[var(--primary)]"
                            }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">psychology</span>
                        Contexto PDF
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${activeTab === "settings"
                            ? "bg-[var(--background-app)] text-[var(--primary)] font-semibold shadow-sm border border-gray-200"
                            : "text-[var(--text-subtle)] hover:bg-[var(--background-app)] hover:text-[var(--primary)]"
                            }`}
                    >
                        <span className="material-symbols-outlined text-[20px]">tune</span>
                        Validacion
                    </button>
                </nav>

                {/* Divider */}
                <div className="px-6 mt-6 mb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Herramientas</span>
                </div>
                <nav className="px-4 space-y-1">
                    <button
                        onClick={() => setActiveTab("settings")}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left text-[var(--text-subtle)] hover:bg-[var(--background-app)] hover:text-[var(--primary)]"
                    >
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                        Configuracion
                    </button>
                    <button
                        onClick={generateAll}
                        disabled={isGeneratingAll || generatingIndex !== null}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left text-[var(--text-subtle)] hover:bg-[var(--background-app)] hover:text-[var(--primary)] disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                        Auto-Reorder
                    </button>
                </nav>

                {/* User info at bottom */}
                <div className="mt-auto p-4 border-t border-[var(--border-subtle)]">
                    <p className="text-xs text-center text-gray-400">
                        {lastSaved ? `Guardado: ${lastSaved.toLocaleTimeString()}` : "Sin guardar"}
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative bg-[var(--background-app)]">
                <div className="w-[95%] max-w-[1400px] mx-auto pb-28 p-8">
                    {/* Questions Tab */}
                    {activeTab === "questions" && (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">Professional Editor</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className="text-sm text-gray-500">Editando Unidad {cards.length}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-600">
                                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                                        Guardado {lastSaved ? lastSaved.toLocaleTimeString() : "--:--"}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                {/* Structure Panel (Left Column) */}
                                <div className="lg:col-span-4 xl:col-span-3">
                                    <div className="bg-white rounded-2xl border border-[var(--border-subtle)] shadow-soft overflow-hidden">
                                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-800 uppercase tracking-wider">Estructura</span>
                                                <span className="text-xs bg-[var(--accent-blue-light)] text-[var(--primary)] font-bold px-2 py-0.5 rounded-full">
                                                    {cards.length} items
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setShowStructure(!showStructure)}
                                                className="p-1 hover:bg-gray-100 rounded text-gray-400"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {showStructure ? "settings" : "expand_more"}
                                                </span>
                                            </button>
                                        </div>

                                        {showStructure && (
                                            <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto">
                                                {cards.map((card, index) => {
                                                    const ra = extractRA(card.question);
                                                    const isActive = expandedCard === index;
                                                    const isDragging = dragIndex === index;
                                                    const isDragOver = dragOverIndex === index;

                                                    return (
                                                        <div
                                                            key={index}
                                                            draggable
                                                            onDragStart={() => handleDragStart(index)}
                                                            onDragOver={(e) => handleDragOver(e, index)}
                                                            onDragEnd={handleDragEnd}
                                                            onClick={() => {
                                                                setExpandedCard(index);
                                                                setActiveTab("questions");
                                                            }}
                                                            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border-l-4 ${isActive
                                                                ? "bg-blue-50 border-l-[var(--primary)] shadow-sm"
                                                                : isDragOver
                                                                    ? "bg-yellow-50 border-l-yellow-400"
                                                                    : "bg-white hover:bg-gray-50 border-l-transparent"
                                                                } ${isDragging ? "opacity-40" : ""}`}
                                                        >
                                                            {/* Number badge */}
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${card.status === "complete"
                                                                ? "bg-green-100 text-green-700"
                                                                : card.status === "review"
                                                                    ? "bg-yellow-100 text-yellow-700"
                                                                    : "bg-gray-100 text-gray-500"
                                                                }`}>
                                                                {String(index + 1).padStart(2, "0")}
                                                            </div>
                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-semibold truncate ${isActive ? "text-[var(--primary)]" : "text-gray-800"}`}>
                                                                    {shortLabel(card.question)}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    {ra && <span className="text-[10px] text-gray-400 font-mono">{ra}</span>}
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${card.status === "complete" ? "text-green-600" : card.status === "review" ? "text-yellow-600" : "text-gray-400"
                                                                        }`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor(card.status)}`} />
                                                                        {statusLabel(card.status)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {/* Drag handle */}
                                                            <span className="material-symbols-outlined text-gray-300 text-[16px] mt-1 flex-shrink-0">drag_indicator</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Editor Panel (Right Column) */}
                                <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                                    {expandedCard !== null && cards[expandedCard] && (() => {
                                        const card = cards[expandedCard];
                                        const index = expandedCard;

                                        return (
                                            <div className="bg-white rounded-2xl border border-[var(--border-subtle)] shadow-soft overflow-hidden">
                                                {/* Format Toolbar */}
                                                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                                                    <div className="flex items-center gap-1">
                                                        {/* Paragraph type selector */}
                                                        <select
                                                            className="text-sm text-gray-600 bg-transparent border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-[var(--primary)] outline-none cursor-pointer"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onChange={(e) => {
                                                                document.execCommand("formatBlock", false, e.target.value);
                                                            }}
                                                            defaultValue="P"
                                                        >
                                                            <option value="P">Parrafo</option>
                                                            <option value="H1">Titulo 1</option>
                                                            <option value="H2">Titulo 2</option>
                                                            <option value="H3">Titulo 3</option>
                                                        </select>

                                                        <div className="w-px h-6 bg-gray-200 mx-2" />

                                                        {/* Bold */}
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 font-bold text-sm transition-colors"
                                                            title="Negrita (Ctrl+B)"
                                                        >
                                                            B
                                                        </button>
                                                        {/* Italic */}
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 italic text-sm transition-colors"
                                                            title="Cursiva (Ctrl+I)"
                                                        >
                                                            I
                                                        </button>
                                                        {/* Underline */}
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 underline text-sm transition-colors"
                                                            title="Subrayado (Ctrl+U)"
                                                        >
                                                            U
                                                        </button>

                                                        <div className="w-px h-6 bg-gray-200 mx-2" />

                                                        {/* Unordered list */}
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); applyFormat("insertUnorderedList"); }}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                                                            title="Lista sin orden"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                                                        </button>
                                                        {/* Ordered list */}
                                                        <button
                                                            onMouseDown={(e) => { e.preventDefault(); applyFormat("insertOrderedList"); }}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                                                            title="Lista ordenada"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">format_list_numbered</span>
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                                        {lastSaved && (
                                                            <>
                                                                Ultima edicion hace {Math.max(1, Math.round((Date.now() - lastSaved.getTime()) / 60000))}m
                                                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Question title */}
                                                <div className="px-8 pt-6 pb-2">
                                                    {editingQuestion === index ? (
                                                        <textarea
                                                            value={card.question}
                                                            onChange={(e) => {
                                                                updateCard(index, { question: e.target.value });
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }}
                                                            onBlur={() => setEditingQuestion(null)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    setEditingQuestion(null);
                                                                }
                                                                if (e.key === 'Escape') setEditingQuestion(null);
                                                            }}
                                                            autoFocus
                                                            rows={1}
                                                            className="w-full text-xl font-bold text-gray-900 bg-white border border-[var(--primary)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary-action)] resize-none overflow-hidden"
                                                            style={{ minHeight: '40px' }}
                                                            ref={(el) => {
                                                                if (el) {
                                                                    el.style.height = 'auto';
                                                                    el.style.height = el.scrollHeight + 'px';
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex items-start gap-3">
                                                            <h2 className="text-xl font-bold text-gray-900 flex-1">{card.question}</h2>
                                                            <button
                                                                onClick={() => setEditingQuestion(index)}
                                                                className="text-gray-300 hover:text-[var(--primary)] transition-colors mt-1"
                                                                title="Editar pregunta"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* RA badge */}
                                                    {extractRA(card.question) && (
                                                        <div className="mt-2">
                                                            <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded">
                                                                IDENTIFICADOR: {extractRA(card.question)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Rich text answer area */}
                                                <div className="px-8 py-4">
                                                    <div
                                                        contentEditable
                                                        suppressContentEditableWarning
                                                        className="w-full min-h-[200px] p-4 bg-white text-gray-700 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none transition-shadow leading-relaxed"
                                                        style={{ whiteSpace: "pre-wrap" }}
                                                        dangerouslySetInnerHTML={{ __html: card.answer || "" }}
                                                        onBlur={(e) => {
                                                            const html = (e.target as HTMLDivElement).innerHTML;
                                                            updateCard(index, {
                                                                answer: html,
                                                                status: (card.status === 'pending' && html.length > 0) ? 'review' : card.status
                                                            });
                                                        }}
                                                        data-placeholder="Escribe aqui la solucion propuesta o las instrucciones adicionales..."
                                                    />
                                                </div>

                                                {/* Card actions */}
                                                <div className="flex items-center justify-between px-8 py-4 border-t border-gray-100">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => updateCard(index, { status: "complete" })}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-xs font-semibold"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                                            Finalizar
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => updateCard(index, { answer: "", status: "pending" })}
                                                            className="text-xs text-[var(--text-subtle)] hover:text-[var(--text-main)] font-medium transition-colors"
                                                        >
                                                            Limpiar
                                                        </button>
                                                        <button
                                                            onClick={() => askAI(index)}
                                                            disabled={generatingIndex === index}
                                                            className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--primary)] hover:bg-gray-700 text-white text-xs font-semibold rounded shadow-sm transition-colors disabled:opacity-50"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                                                            {generatingIndex === index ? "Generando..." : "Preguntar a IA"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Navigation: prev/next */}
                                    {expandedCard !== null && (
                                        <div className="flex justify-between">
                                            <button
                                                onClick={() => setExpandedCard(Math.max(0, (expandedCard ?? 0) - 1))}
                                                disabled={expandedCard === 0}
                                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--primary)] transition-colors disabled:opacity-30"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                                Anterior
                                            </button>
                                            <span className="text-sm text-gray-400">{(expandedCard ?? 0) + 1} / {cards.length}</span>
                                            <button
                                                onClick={() => setExpandedCard(Math.min(cards.length - 1, (expandedCard ?? 0) + 1))}
                                                disabled={expandedCard === cards.length - 1}
                                                className="flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--primary)] transition-colors disabled:opacity-30"
                                            >
                                                Siguiente
                                                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )
                    }

                    {/* Context Tab */}
                    {
                        activeTab === "context" && (
                            <div className="max-w-3xl mx-auto">
                                <div className="bg-white rounded-xl shadow-card border border-[var(--border-subtle)] p-6">
                                    <h3 className="font-bold text-[var(--primary)] mb-2 flex items-center gap-2 text-lg">
                                        <span className="material-symbols-outlined text-xl">psychology</span>
                                        Contexto para IA
                                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 ml-2">
                                            No se exporta al Docx final
                                        </span>
                                    </h3>
                                    <p className="text-sm text-[var(--text-subtle)] mb-4 leading-relaxed">
                                        Este apartado sirve para que pegues aqui toda la informacion teorica, formulas o apuntes que la Inteligencia Artificial deba &quot;leer&quot; antes de responder a tus preguntas. <br />
                                        <strong>Lo que escribas aqui NO aparecera en tu documento final.</strong>
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
                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                                        >
                                            {isUploadingContext ? (
                                                <>
                                                    <div className="animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full"></div>
                                                    Leyendo archivo...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-lg">upload_file</span>
                                                    Adjuntar PDF / DOCX / IMG
                                                </>
                                            )}
                                        </button>
                                        <p className="text-xs text-gray-400 mt-1.5 ml-1">
                                            Se extraera el texto y se anadira al final del campo de texto.
                                        </p>
                                    </div>

                                    {/* Attachments List */}
                                    {attachments.length > 0 && (
                                        <div className="mb-4 flex flex-wrap gap-2">
                                            {attachments.map((att, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">
                                                        {att.name.split('.').pop()?.slice(0, 3) || "FILE"}
                                                    </span>
                                                    <span className="text-xs font-medium text-gray-700 max-w-[150px] truncate" title={att.name}>
                                                        {att.name}
                                                    </span>
                                                    <button
                                                        onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                                        className="ml-1 p-0.5 rounded-full hover:bg-slate-200 text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <textarea
                                        value={taskContext}
                                        onChange={(e) => setTaskContext(e.target.value)}
                                        className="w-full h-[500px] bg-sky-50 border border-sky-100 rounded-lg p-4 text-base focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-y"
                                        placeholder="Pega aqui el temario, apuntes o contexto..."
                                    />
                                </div>
                            </div>
                        )
                    }

                    {/* Settings Tab */}
                    {
                        activeTab === "settings" && (
                            <div className="max-w-3xl mx-auto">
                                <div className="bg-white rounded-xl shadow-card border border-[var(--border-subtle)] p-6">
                                    <h3 className="font-bold text-[var(--primary)] mb-4 flex items-center gap-2 text-lg">
                                        <span className="material-symbols-outlined text-xl">settings</span>
                                        Configuracion
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Plantilla seleccionada</label>
                                            <p className="text-sm text-[var(--text-subtle)]">{templateType === "FOC" ? "Instituto FOC" : "Generica"}</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Total de preguntas</label>
                                            <p className="text-sm text-[var(--text-subtle)]">{cards.length} preguntas detectadas</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
            </main >

            {/* Footer */}
            <footer className="fixed bottom-0 left-64 right-0 h-16 bg-white border-t border-[var(--border-subtle)] flex items-center justify-between px-8 z-20">
                <div className="flex items-center gap-3">
                    <button
                        className="flex items-center gap-2 px-5 py-2 bg-[var(--accent-blue-light)] text-[var(--primary)] rounded-lg font-semibold text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">find_in_page</span>
                        Localizar en PDF fuente
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href={`/app/preview?id=${documentId}`}
                        className="flex items-center gap-2 px-5 py-2 border border-[var(--border-subtle)] text-[var(--text-main)] rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                        Previsualizar
                    </Link>
                    <button
                        onClick={validateAll}
                        disabled={isValidating || isSaving}
                        className="flex items-center gap-2 px-5 py-2 bg-[var(--primary)] text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        {isValidating ? "Validando..." : isSaving ? "Guardando..." : "Validar Contenido"}
                    </button>
                </div>
            </footer>
        </div >
    );
}


export default function EditorPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full"></div>
            </div>
        }>
            <EditorContent />
        </Suspense>
    );
}
