"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Template = "FOC" | "CUSTOM";

interface ParseResult {
    text: string;
    questions: string[];
}

export default function UploadPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<Template>("FOC");
    const [file, setFile] = useState<File | null>(null);
    const [rawText, setRawText] = useState("");
    const [inputMode, setInputMode] = useState<"file" | "text" | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setRawText(""); // Clear text
            setInputMode("file");
            setError(null);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setRawText(text);
        if (text.length > 0) {
            setFile(null); // Clear file
            setInputMode("text");
            setError(null);
        } else {
            setInputMode(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
            setRawText("");
            setInputMode("file");
            setError(null);
        }
    };

    const handleSubmit = async () => {
        if (!inputMode) {
            setError("Por favor, sube un archivo o escribe el enunciado.");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            let parseRes;

            // Mode: FILE
            if (inputMode === "file" && file) {
                const formData = new FormData();
                formData.append("file", file);

                parseRes = await fetch("/api/parse", {
                    method: "POST",
                    body: formData,
                });
            }
            // Mode: TEXT
            else if (inputMode === "text" && rawText.trim().length > 0) {
                parseRes = await fetch("/api/parse", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: rawText }),
                });
            } else {
                setError("Selecciona un archivo o escribe texto.");
                setIsProcessing(false);
                return;
            }

            if (!parseRes.ok) {
                const errData = await parseRes.json();
                throw new Error(errData.error || "Error al procesar el archivo");
            }

            const parseData: ParseResult = await parseRes.json();

            // Create document
            const docRes = await fetch("/api/documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateType: selectedTemplate,
                    sourceText: parseData.text,
                    questions: parseData.questions,
                }),
            });

            if (!docRes.ok) {
                const errData = await docRes.json();
                throw new Error(errData.error || "Error al crear el documento");
            }

            const docData = await docRes.json();
            router.push(`/app/editor?id=${docData.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setIsProcessing(false);
        }
    };

    const statusText = inputMode ? "Listo para procesar" : "Esperando contenido...";
    const statusColor = inputMode ? "bg-green-500" : "bg-yellow-400";

    return (
        <div className="flex-grow w-full overflow-y-auto pb-24">
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
                {/* Header */}
                <header className="mb-8 text-center md:text-left">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Generador de Borradores</h1>
                    <p className="text-gray-500 max-w-2xl text-sm">
                        Sube tu enunciado en PDF, Word o texto, elige la plantilla y genera un borrador automaticamente con IA.
                    </p>
                </header>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                    {/* === Left Column: Upload === */}
                    <div className="col-span-1 md:col-span-7 flex flex-col gap-6">
                        {/* Step 1 header */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shadow-lg">1</div>
                            <h2 className="font-semibold text-gray-800 text-lg">Subir Enunciado</h2>
                        </div>

                        {/* Dropzone */}
                        <div
                            className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group h-64 relative overflow-hidden ${inputMode === "file" && file
                                ? "border-green-400 bg-green-50"
                                : "border-gray-300 bg-white hover:border-[var(--primary)] hover:bg-blue-50/30"
                                }`}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {/* Hover background overlay */}
                            {!(inputMode === "file" && file) && (
                                <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.txt"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {inputMode === "file" && file ? (
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                        <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{file.name}</h3>
                                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFile(null);
                                            setInputMode(null);
                                        }}
                                        className="mt-3 text-xs text-red-500 hover:underline font-medium"
                                    >
                                        Quitar archivo
                                    </button>
                                </div>
                            ) : (
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-blue-100 text-[var(--primary)] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-1">Arrastra o selecciona</h3>
                                    <p className="text-sm text-gray-500">Soporta archivos PDF o TXT</p>
                                </div>
                            )}
                        </div>

                        {/* Text area card */}
                        <div className={`bg-white rounded-2xl shadow-soft p-6 border transition-all flex-grow flex flex-col ${inputMode === "text"
                            ? "border-[var(--primary)] ring-2 ring-[var(--accent-blue-light)]"
                            : "border-gray-100"
                            }`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-gray-400 text-xl">content_paste</span>
                                    <h3 className="font-semibold text-gray-700">O pega tu texto aqui</h3>
                                </div>
                                {inputMode === "text" && (
                                    <button
                                        onClick={() => {
                                            setRawText("");
                                            setInputMode(null);
                                        }}
                                        className="text-xs font-medium text-[var(--primary)] hover:underline"
                                    >
                                        Limpiar
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={rawText}
                                onChange={handleTextChange}
                                className="w-full flex-grow bg-transparent border-none resize-none focus:ring-0 text-gray-600 text-sm placeholder-gray-400 outline-none min-h-[100px]"
                                placeholder="Pega el contenido del enunciado aqui para visualizarlo..."
                            />
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                                <span className="text-xs text-gray-400">{rawText.length} caracteres</span>
                                <div className="flex gap-2">
                                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 transition-colors">
                                        <span className="material-symbols-outlined text-sm">format_bold</span>
                                    </button>
                                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 transition-colors">
                                        <span className="material-symbols-outlined text-sm">format_italic</span>
                                    </button>
                                    <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 transition-colors">
                                        <span className="material-symbols-outlined text-sm">grid_view</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* === Right Column: Templates === */}
                    <div className="col-span-1 md:col-span-5 flex flex-col gap-6">
                        {/* Step 2 header */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shadow-lg">2</div>
                            <h2 className="font-semibold text-gray-800 text-lg">Seleccionar Plantilla</h2>
                        </div>

                        {/* Template cards */}
                        <div className="grid grid-cols-1 gap-4">
                            {/* Instituto FOC - Selected/Active card */}
                            <button
                                onClick={() => setSelectedTemplate("FOC")}
                                className={`text-left rounded-2xl p-5 transition-all cursor-pointer relative overflow-hidden ${selectedTemplate === "FOC"
                                    ? "bg-[var(--primary)] shadow-lg border-2 border-transparent"
                                    : "bg-white shadow-soft border border-gray-100 hover:border-[var(--primary)]"
                                    }`}
                            >
                                {selectedTemplate === "FOC" && (
                                    <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--primary)] z-10" />
                                )}
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedTemplate === "FOC" ? "bg-white/10" : "bg-gray-100"
                                        }`}>
                                        <span className={`material-symbols-outlined ${selectedTemplate === "FOC" ? "text-white" : "text-gray-500"}`}>school</span>
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-lg ${selectedTemplate === "FOC" ? "text-white" : "text-gray-800"}`}>Instituto FOC</h3>
                                        <p className={`text-xs mt-1 ${selectedTemplate === "FOC" ? "text-blue-200" : "text-gray-500"}`}>Plantilla oficial para examenes y tareas academicas.</p>
                                    </div>
                                </div>
                                {selectedTemplate === "FOC" && (
                                    <div className="mt-4 flex gap-2">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 bg-white/10 px-2 py-1 rounded">Oficial</span>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 bg-white/10 px-2 py-1 rounded">A4</span>
                                    </div>
                                )}
                            </button>

                            {/* Crear mi propia plantilla */}
                            <button
                                onClick={() => setSelectedTemplate("CUSTOM")}
                                className={`text-left rounded-2xl p-5 transition-all cursor-pointer relative overflow-hidden group ${selectedTemplate === "CUSTOM"
                                    ? "bg-[var(--primary)] shadow-lg border-2 border-transparent"
                                    : "bg-white shadow-soft border border-gray-100 hover:border-[var(--primary)]"
                                    }`}
                            >
                                {selectedTemplate === "CUSTOM" && (
                                    <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--primary)] z-10" />
                                )}
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedTemplate === "CUSTOM"
                                        ? "bg-white/10"
                                        : "bg-gray-100 group-hover:bg-blue-50 group-hover:text-[var(--primary)]"
                                        }`}>
                                        <span className={`material-symbols-outlined ${selectedTemplate === "CUSTOM" ? "text-white" : "text-gray-500 group-hover:text-[var(--primary)]"}`}>edit_document</span>
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-lg transition-colors ${selectedTemplate === "CUSTOM" ? "text-white" : "text-gray-800 group-hover:text-[var(--primary)]"}`}>Crear mi propia plantilla</h3>
                                        <p className={`text-xs mt-1 ${selectedTemplate === "CUSTOM" ? "text-blue-200" : "text-gray-500"}`}>Titulo editable y formato limpio sin logo.</p>
                                    </div>
                                </div>
                                {selectedTemplate === "CUSTOM" && (
                                    <div className="mt-4 flex gap-2">
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 bg-white/10 px-2 py-1 rounded">Personalizable</span>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 bg-white/10 px-2 py-1 rounded">A4</span>
                                    </div>
                                )}
                            </button>

                            {/* Nueva Plantilla placeholder */}
                            <button
                                disabled
                                className="bg-transparent border-2 border-dashed border-gray-300 rounded-2xl p-5 flex items-center justify-center gap-3 cursor-not-allowed hover:bg-gray-50 transition-colors text-gray-400 h-20"
                            >
                                <span className="material-symbols-outlined">add</span>
                                <span className="font-medium">Nueva Plantilla</span>
                            </button>
                        </div>

                        {/* AI Tip */}
                        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-5 border border-indigo-100">
                            <div className="flex items-center gap-2 mb-2 text-indigo-600">
                                <span className="material-symbols-outlined text-sm">tips_and_updates</span>
                                <span className="text-xs font-bold uppercase tracking-wide">AI Tip</span>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                La plantilla &quot;Instituto FOC&quot; utiliza un formato especifico de cabecera. Asegurate de que tu PDF incluya el nombre del alumno para autocompletar.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200 mt-6">
                        {error}
                    </div>
                )}
            </div>

            {/* Sticky bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[var(--border-subtle)] p-4 z-20">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Status indicator */}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                        <span>{statusText}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button
                            disabled={isProcessing || !inputMode}
                            className="flex-1 md:flex-none px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Guardar Borrador
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isProcessing || !inputMode}
                            className="flex-1 md:flex-none px-8 py-3 rounded-xl bg-[#F0A0A0] hover:bg-[#E57373] text-red-900 font-bold shadow-lg shadow-red-200/50 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                    Procesar y Generar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
