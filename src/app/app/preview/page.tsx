"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface DocumentData {
    id: string;
    templateType: string;
    subject?: string;
    topic?: string;
    questions: string[];
    answers: Record<number, string>;
    status: string;
}

function PreviewContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const documentId = searchParams.get("id");

    const [document, setDocument] = useState<DocumentData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filename picker state
    const [showFilenameModal, setShowFilenameModal] = useState(false);
    const [filename, setFilename] = useState("");
    const [userMeta, setUserMeta] = useState({
        asignatura: "",
        apellidos: "",
        nombre: "",
        dni: "",
        tema: "",
    });

    // Load user metadata from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("docututor_user_meta");
        if (saved) {
            try {
                setUserMeta(JSON.parse(saved));
            } catch { /* ignore */ }
        }
    }, []);

    // Save user metadata to localStorage when changed
    const updateUserMeta = (field: string, value: string) => {
        const updated = { ...userMeta, [field]: value };
        setUserMeta(updated);
        localStorage.setItem("docututor_user_meta", JSON.stringify(updated));
    };

    // Sanitize filename for Windows/Mac compatibility
    const sanitizeFilename = (name: string): string => {
        // Remove invalid chars: \ / : * ? " < > |
        let sanitized = name.replace(/[\\/:*?"<>|]/g, "");
        // Replace multiple spaces/underscores with single underscore
        sanitized = sanitized.replace(/[\s_]+/g, "_");
        // Remove leading/trailing underscores and dots
        sanitized = sanitized.replace(/^[_.\s]+|[_.\s]+$/g, "");
        // Limit length (leave room for .docx)
        if (sanitized.length > 116) {
            sanitized = sanitized.substring(0, 116);
        }
        // Ensure .docx extension
        if (!sanitized.toLowerCase().endsWith(".docx")) {
            sanitized += ".docx";
        }
        return sanitized || "documento.docx";
    };

    // Generate default filename from user metadata
    const generateDefaultFilename = () => {
        const parts = [
            userMeta.asignatura || "ASIGNATURA",
            userMeta.apellidos || "APELLIDOS",
            userMeta.nombre || "NOMBRE",
            userMeta.dni || "DNI",
            userMeta.tema || "TEMA",
        ];
        return sanitizeFilename(parts.join("_"));
    };

    useEffect(() => {
        if (!documentId) {
            router.push("/app/upload");
            return;
        }

        const loadDocument = async () => {
            try {
                const res = await fetch(`/api/documents/${documentId}`);
                if (!res.ok) throw new Error("Documento no encontrado");
                const data = await res.json();
                setDocument(data);
                setIsLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error al cargar");
                setIsLoading(false);
            }
        };

        loadDocument();
    }, [documentId, router]);

    // Open filename modal instead of exporting directly
    const openExportModal = () => {
        setFilename(generateDefaultFilename());
        setShowFilenameModal(true);
    };

    const handleExport = async () => {
        if (!documentId) return;

        setShowFilenameModal(false);
        setIsExporting(true);
        try {
            const res = await fetch(`/api/export/${documentId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    asignatura: userMeta.asignatura,
                    tema: userMeta.tema,
                    apellidos: userMeta.apellidos,
                    nombre: userMeta.nombre,
                    dni: userMeta.dni,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al exportar");
            }

            // Download the file with custom filename
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = window.document.createElement("a");
            a.href = url;
            a.download = sanitizeFilename(filename);
            window.document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al exportar");
        } finally {
            setIsExporting(false);
        }
    };

    // Extract RA code from question if present
    const extractRA = (question: string): string | null => {
        const match = question.match(/\(?(RA\d+_[a-z])\)?/i);
        return match ? match[1].toUpperCase() : null;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-[#004785] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-12 text-center">
                <p className="text-red-600 dark:text-red-400 mb-4">{error || "Documento no encontrado"}</p>
                <Link href="/app/upload" className="text-[#004785] hover:underline">
                    Volver a subir archivo
                </Link>
            </div>
        );
    }

    const completedCount = Object.values(document.answers).filter((a) => a && a.length > 10).length;

    return (
        <div className="max-w-2xl mx-auto px-4 py-6 pb-44 space-y-6">
            {/* Status banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3 items-start">
                <svg className="w-5 h-5 text-[#004785] dark:text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    {completedCount} de {document.questions.length} preguntas completadas.
                    {completedCount === document.questions.length
                        ? " ¡Listo para exportar!"
                        : " Puedes exportar o seguir editando."}
                </p>
            </div>

            {/* Preview cards */}
            <div className="space-y-6">
                {document.questions.map((question, index) => {
                    const answer = document.answers[index] || "";
                    const raCode = extractRA(question);

                    return (
                        <article
                            key={index}
                            className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                            {/* Header */}
                            <div className="bg-[#004785] px-4 py-3 border-b border-blue-800">
                                <h3 className="font-semibold text-white text-sm leading-snug">
                                    {raCode ? `(${raCode}) ` : ""}{question.replace(/\(RA\d+_[a-z]\)/gi, "").trim()}
                                </h3>
                            </div>

                            {/* Content */}
                            <div className="p-5 space-y-5">
                                {/* Question excerpt */}
                                <div className="relative pl-3 border-l-4 border-gray-200 dark:border-slate-600">
                                    <label className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-1 tracking-wider">
                                        Enunciado
                                    </label>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {question}
                                    </p>
                                </div>

                                {/* Answer */}
                                <div className="relative pl-3 border-l-4 border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 -mr-2 rounded-r-lg py-2">
                                    <label className="block text-[10px] uppercase font-bold text-[#004785] dark:text-blue-400 mb-2 tracking-wider">
                                        Respuesta
                                    </label>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {answer || <span className="text-gray-400 italic">Sin respuesta</span>}
                                    </p>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>

            {/* Info text */}
            <p className="text-center text-xs text-gray-400 italic">
                Mostrando {document.questions.length} preguntas • Plantilla: {document.templateType}
            </p>

            {/* Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 pb-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
                <div className="max-w-2xl mx-auto flex flex-col gap-3">
                    <button
                        onClick={openExportModal}
                        disabled={isExporting}
                        className="w-full bg-[#004785] hover:bg-blue-800 text-white font-bold text-base py-4 px-6 rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isExporting ? (
                            <>
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Generando Word...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Descargar Word (.docx)
                            </>
                        )}
                    </button>
                    <Link
                        href={`/app/editor?id=${documentId}`}
                        className="w-full bg-transparent hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 font-medium py-3 px-6 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar respuestas
                    </Link>
                </div>
            </div>

            {/* Filename Modal */}
            {showFilenameModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
                        <h3 className="text-lg font-bold text-[#004785] dark:text-blue-400">Configurar nombre del archivo</h3>

                        {/* User metadata fields */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Asignatura</label>
                                <input
                                    type="text"
                                    value={userMeta.asignatura}
                                    onChange={(e) => { updateUserMeta("asignatura", e.target.value); setFilename(generateDefaultFilename()); }}
                                    placeholder="DAW"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[#004785] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tema</label>
                                <input
                                    type="text"
                                    value={userMeta.tema}
                                    onChange={(e) => { updateUserMeta("tema", e.target.value); setFilename(generateDefaultFilename()); }}
                                    placeholder="Tarea 4 - UML"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[#004785] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Apellidos</label>
                                <input
                                    type="text"
                                    value={userMeta.apellidos}
                                    onChange={(e) => { updateUserMeta("apellidos", e.target.value); setFilename(generateDefaultFilename()); }}
                                    placeholder="García Ortega"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[#004785] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={userMeta.nombre}
                                    onChange={(e) => { updateUserMeta("nombre", e.target.value); setFilename(generateDefaultFilename()); }}
                                    placeholder="Daniel"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[#004785] focus:border-transparent"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">DNI</label>
                                <input
                                    type="text"
                                    value={userMeta.dni}
                                    onChange={(e) => { updateUserMeta("dni", e.target.value); setFilename(generateDefaultFilename()); }}
                                    placeholder="12345678A"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[#004785] focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Filename preview/edit */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Nombre del archivo</label>
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-[#004785] dark:border-blue-500 rounded-lg bg-blue-50 dark:bg-slate-900 focus:ring-2 focus:ring-[#004785] font-mono"
                            />
                            <p className="text-xs text-gray-400 mt-1">Se sanitizará automáticamente al descargar</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowFilenameModal(false)}
                                className="flex-1 py-2.5 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex-1 py-2.5 px-4 text-sm font-bold text-white bg-[#004785] hover:bg-blue-800 rounded-lg shadow transition-colors"
                            >
                                Descargar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PreviewPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-[#004785] border-t-transparent rounded-full"></div>
            </div>
        }>
            <PreviewContent />
        </Suspense>
    );
}
