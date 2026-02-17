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

    // Cover edits state — editable fields for the preview cover
    const [coverEdits, setCoverEdits] = useState({
        titulo: "",
        subtitulo: "",
    });

    // Load user metadata from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("docututor_user_meta");
        if (saved) {
            try {
                setUserMeta(JSON.parse(saved));
            } catch { /* ignore */ }
        }
        const savedCover = localStorage.getItem("docututor_cover_edits");
        if (savedCover) {
            try {
                setCoverEdits(JSON.parse(savedCover));
            } catch { /* ignore */ }
        }
    }, []);

    // Save user metadata to localStorage when changed
    const updateUserMeta = (field: string, value: string) => {
        const updated = { ...userMeta, [field]: value };
        setUserMeta(updated);
        localStorage.setItem("docututor_user_meta", JSON.stringify(updated));
    };

    const updateCoverEdit = (field: keyof typeof coverEdits, value: string) => {
        const updated = { ...coverEdits, [field]: value };
        setCoverEdits(updated);
        localStorage.setItem("docututor_cover_edits", JSON.stringify(updated));
    };

    // Sanitize filename for Windows/Mac compatibility
    const sanitizeFilename = (name: string): string => {
        let sanitized = name.replace(/[\\/:*?"<>|]/g, "");
        sanitized = sanitized.replace(/[\s_]+/g, "_");
        sanitized = sanitized.replace(/^[_.\s]+|[_.\s]+$/g, "");
        if (sanitized.length > 116) {
            sanitized = sanitized.substring(0, 116);
        }
        if (!sanitized.toLowerCase().endsWith(".docx")) {
            sanitized += ".docx";
        }
        return sanitized || "documento.docx";
    };

    // Generate filename from metadata object
    const generateFilenameFromMeta = (meta: typeof userMeta) => {
        const parts = [
            meta.asignatura || "ASIGNATURA",
            meta.apellidos || "APELLIDOS",
            meta.nombre || "NOMBRE",
            meta.dni || "DNI",
            meta.tema || "TEMA",
        ];
        return sanitizeFilename(parts.join("_"));
    };

    // Update metadata and regenerate filename immediately
    const handleMetaChange = (field: keyof typeof userMeta, value: string) => {
        const updatedMeta = { ...userMeta, [field]: value };
        setUserMeta(updatedMeta);
        localStorage.setItem("docututor_user_meta", JSON.stringify(updatedMeta));
        setFilename(generateFilenameFromMeta(updatedMeta));
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

    const openExportModal = () => {
        if (!filename) {
            setFilename(generateFilenameFromMeta(userMeta));
        }
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
                    coverTitulo: coverEdits.titulo,
                    coverSubtitulo: coverEdits.subtitulo,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al exportar");
            }

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

    const isFOC = document?.templateType?.toUpperCase().includes("FOC");
    const isCustom = document?.templateType?.toUpperCase().includes("CUSTOM");

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="flex-grow flex flex-col h-full bg-[var(--background-app)] relative overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between shrink-0 z-10">
                <div>
                    <h1 className="text-xl font-bold text-[var(--primary)]">Vista Previa</h1>
                    <p className="text-xs text-[var(--text-subtle)]">Revisa el contenido antes de exportar — haz clic en los textos de la portada para editarlos</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href={`/app/editor?id=${documentId}`}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                        Editar
                    </Link>
                    <button
                        onClick={openExportModal}
                        disabled={isExporting}
                        className="px-4 py-2 text-sm font-bold text-white bg-[var(--primary-action)] hover:bg-red-500 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting ? (
                            <>
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                Exportando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">download</span>
                                Exportar Word
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-y-auto p-8">
                {error ? (
                    <div className="text-center text-red-500 py-10">{error}</div>
                ) : !document ? (
                    <div className="text-center py-10">Cargando...</div>
                ) : (
                    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 shadow-card rounded-xl min-h-[800px] p-12 relative">
                        {/* Cover Page */}
                        <div className="border-b-2 border-dashed border-gray-200 dark:border-gray-700 pb-12 mb-12">
                            {isFOC ? (
                                <>
                                    {/* FOC Cover — logo + CICLO:DAW + editable fields */}
                                    <div className="flex justify-between items-start mb-20">
                                        <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded">
                                            <span className="text-xs text-gray-400">[LOGO]</span>
                                        </div>
                                        <div className="text-right">
                                            <h2 className="text-2xl font-bold text-[var(--primary)] font-[Calibri]">CICLO: DAW</h2>
                                            <input
                                                type="text"
                                                value={userMeta.asignatura}
                                                onChange={(e) => updateUserMeta("asignatura", e.target.value)}
                                                placeholder="ASIGNATURA"
                                                className="text-2xl font-bold text-[var(--primary)] font-[Calibri] uppercase text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-[var(--primary)] outline-none w-full transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-center py-12">
                                        <input
                                            type="text"
                                            value={coverEdits.titulo || `${userMeta.asignatura || "ASIGNATURA"} Y ${userMeta.tema || "TEMA"}`}
                                            onChange={(e) => updateCoverEdit("titulo", e.target.value)}
                                            placeholder="TITULO DEL DOCUMENTO"
                                            className="text-5xl font-bold text-[var(--primary)] font-[Arial] uppercase leading-tight text-center bg-transparent border-b-2 border-dashed border-transparent hover:border-gray-300 focus:border-[var(--primary)] outline-none w-full transition-colors"
                                        />
                                    </div>

                                    <div className="text-right mt-16 space-y-1">
                                        <h3 className="text-2xl font-bold text-[var(--primary)] font-[Arial]">Alumno:</h3>
                                        <input
                                            type="text"
                                            value={userMeta.apellidos}
                                            onChange={(e) => updateUserMeta("apellidos", e.target.value)}
                                            placeholder="APELLIDOS"
                                            className="text-2xl font-bold text-[var(--primary)] font-[Arial] uppercase text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-[var(--primary)] outline-none w-full transition-colors"
                                        />
                                        <input
                                            type="text"
                                            value={userMeta.nombre}
                                            onChange={(e) => updateUserMeta("nombre", e.target.value)}
                                            placeholder="NOMBRE"
                                            className="text-2xl font-bold text-[var(--primary)] font-[Arial] uppercase text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-[var(--primary)] outline-none w-full transition-colors"
                                        />
                                        <input
                                            type="text"
                                            value={userMeta.dni}
                                            onChange={(e) => updateUserMeta("dni", e.target.value)}
                                            placeholder="DNI"
                                            className="text-2xl font-bold text-[var(--primary)] font-[Arial] text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-[var(--primary)] outline-none w-full transition-colors"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* CUSTOM Cover — simple, big editable title, no logo */}
                                    <div className="text-center py-32">
                                        <input
                                            type="text"
                                            value={coverEdits.titulo}
                                            onChange={(e) => updateCoverEdit("titulo", e.target.value)}
                                            placeholder="TITULO DEL DOCUMENTO"
                                            className="text-5xl font-bold text-[var(--primary)] font-[Arial] uppercase leading-tight text-center bg-transparent border-b-2 border-dashed border-transparent hover:border-gray-300 focus:border-[var(--primary)] outline-none w-full transition-colors"
                                        />
                                        <input
                                            type="text"
                                            value={coverEdits.subtitulo}
                                            onChange={(e) => updateCoverEdit("subtitulo", e.target.value)}
                                            placeholder="Subtitulo (opcional)"
                                            className="text-2xl text-gray-500 font-[Arial] text-center bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-gray-400 outline-none w-full mt-6 transition-colors"
                                        />
                                    </div>

                                    <div className="text-right mt-8 space-y-1">
                                        <input
                                            type="text"
                                            value={userMeta.nombre}
                                            onChange={(e) => updateUserMeta("nombre", e.target.value)}
                                            placeholder="Nombre y apellidos"
                                            className="text-xl font-semibold text-[var(--primary)] font-[Arial] text-right bg-transparent border-b border-dashed border-transparent hover:border-gray-300 focus:border-[var(--primary)] outline-none w-full transition-colors"
                                        />
                                    </div>
                                </>
                            )}

                            <p className="text-center text-xs text-gray-400 mt-12 italic">
                                Haz clic en los textos para editarlos — se guardarán en el Word exportado
                            </p>
                        </div>

                        {/* Content — answers as HTML */}
                        <div className="space-y-8">
                            {Object.entries(document.answers).map(([idx, answer]) => {
                                const question = document.questions[parseInt(idx)];
                                return (
                                    <div key={idx} className="mb-8">
                                        <h3 className="text-lg font-bold text-[var(--primary)] mb-2 font-[Cambria]">{question}</h3>
                                        <div
                                            className="text-base text-gray-800 dark:text-gray-200 font-[Arial] whitespace-pre-wrap leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: answer || "" }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Export Filename Modal */}
            {showFilenameModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-[var(--primary)] mb-4">Configurar nombre del archivo</h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Asignatura</label>
                                <input
                                    type="text"
                                    value={userMeta.asignatura}
                                    onChange={(e) => handleMetaChange("asignatura", e.target.value)}
                                    placeholder="SI"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tema</label>
                                <input
                                    type="text"
                                    value={userMeta.tema}
                                    onChange={(e) => handleMetaChange("tema", e.target.value)}
                                    placeholder="T22"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Apellidos</label>
                                <input
                                    type="text"
                                    value={userMeta.apellidos}
                                    onChange={(e) => handleMetaChange("apellidos", e.target.value)}
                                    placeholder="Garcia Ortega"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    value={userMeta.nombre}
                                    onChange={(e) => handleMetaChange("nombre", e.target.value)}
                                    placeholder="Daniel"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">DNI</label>
                                <input
                                    type="text"
                                    value={userMeta.dni}
                                    onChange={(e) => handleMetaChange("dni", e.target.value)}
                                    placeholder="12345678A"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Filename preview/edit */}
                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Nombre del archivo</label>
                            <input
                                type="text"
                                value={filename}
                                onChange={(e) => setFilename(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-[var(--primary)] rounded-lg bg-[var(--accent-blue-light)] focus:ring-2 focus:ring-[var(--primary)] font-mono"
                            />
                            <p className="text-xs text-gray-400 mt-1">Se sanitizará automáticamente al descargar</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowFilenameModal(false)}
                                className="flex-1 py-2.5 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex-1 py-2.5 px-4 text-sm font-bold text-white bg-[var(--primary-action)] hover:bg-red-500 rounded-lg shadow transition-colors"
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
                <div className="animate-spin h-8 w-8 border-4 border-[var(--primary)] border-t-transparent rounded-full"></div>
            </div>
        }>
            <PreviewContent />
        </Suspense>
    );
}
