"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Template = "FOC" | "GENERIC";

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
                    // Browser sets boundary automatically needed for multipart
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

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {/* Intro */}
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Sube tu enunciado en PDF, Word o texto, elige la plantilla y genera un borrador automáticamente.
            </p>

            {/* Section 1: File Upload */}
            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#004785] text-white text-xs font-bold">1</span>
                    Subir Enunciado
                </h2>



                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* LEFT: DROPZONE */}
                    <div
                        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl h-60 flex flex-col items-center justify-center transition-all ${inputMode === "file" && file
                            ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                            : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700"
                            }`}
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.doc,.txt"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {inputMode === "file" && file ? (
                            <>
                                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                                    <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm px-2 text-center break-words max-w-full">
                                    {file.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                        setInputMode(null);
                                    }}
                                    className="mt-3 text-xs text-red-500 hover:underline"
                                >
                                    Quitar archivo
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-slate-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 text-[#004785] dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">Arrastra o selecciona</p>
                                <p className="text-xs text-gray-400 mt-1">PDF, Word o TXT</p>
                            </>
                        )}
                    </div>

                    {/* RIGHT: TEXT AREA */}
                    <div className={`relative rounded-2xl border-2 transition-all h-60 flex flex-col ${inputMode === "text"
                        ? "border-[#004785] bg-white dark:bg-slate-800 ring-2 ring-blue-100 dark:ring-blue-900/20"
                        : "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50"
                        }`}>
                        <div className="absolute top-3 right-3 z-10">
                            {inputMode === "text" && (
                                <button
                                    onClick={() => {
                                        setRawText("");
                                        setInputMode(null);
                                    }}
                                    className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition-colors"
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>
                        <textarea
                            value={rawText}
                            onChange={handleTextChange}
                            placeholder="O pega aquí tu enunciado o preguntas directamente..."
                            className="w-full h-full bg-transparent p-4 resize-none outline-none text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400"
                        />
                        {/* Character count / status */}
                        <div className="absolute bottom-3 right-3 text-[10px] text-gray-400">
                            {rawText.length} caracteres
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 2: Template Selection */}
            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-200 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#004785] text-white text-xs font-bold">2</span>
                    Seleccionar Plantilla
                </h2>

                {/* FOC Template */}
                <div
                    onClick={() => setSelectedTemplate("FOC")}
                    className={`relative cursor-pointer rounded-2xl border-2 overflow-hidden transition-all ${selectedTemplate === "FOC"
                        ? "border-[#004785] shadow-lg"
                        : "border-gray-200 dark:border-slate-700 hover:border-gray-300"
                        }`}
                >
                    {selectedTemplate === "FOC" && (
                        <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg z-10 border-2 border-white dark:border-slate-800">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}

                    {/* Mini doc preview */}
                    <div className="h-28 bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                        <div className="w-2/3 h-full bg-white shadow-md pt-4 px-3 flex flex-col gap-2">
                            <div className="w-6 h-6 rounded-full border border-blue-900/20 flex items-center justify-center bg-blue-50">
                                <span className="text-[6px] font-black text-blue-900">FOC</span>
                            </div>
                            <div className="h-1.5 w-1/2 bg-blue-900/80 rounded-sm"></div>
                            <div className="h-1.5 w-3/4 bg-blue-900/40 rounded-sm"></div>
                        </div>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Instituto FOC</h3>
                            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded font-medium">Oficial</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Formato estándar DAW/DAM</p>
                    </div>
                </div>

                {/* Generic Template */}
                <div
                    onClick={() => setSelectedTemplate("GENERIC")}
                    className={`relative cursor-pointer rounded-2xl border-2 overflow-hidden transition-all ${selectedTemplate === "GENERIC"
                        ? "border-[#004785] shadow-lg"
                        : "border-gray-200 dark:border-slate-700 hover:border-gray-300"
                        }`}
                >
                    {selectedTemplate === "GENERIC" && (
                        <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg z-10 border-2 border-white dark:border-slate-800">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    )}

                    <div className="p-4 bg-white dark:bg-slate-800 flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Plantilla Genérica</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Sin formato institucional</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
                    {error}
                </div>
            )}

            {/* Submit Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-white/0 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/0 pt-12 pb-8 px-4 z-20 pointer-events-none">
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        onClick={handleSubmit}
                        disabled={isProcessing || !inputMode}
                        className="w-full bg-[#004785] hover:bg-[#003366] text-white font-semibold py-4 px-6 rounded-xl shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
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
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                                Procesar y Generar Borrador
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Bottom padding for fixed button */}
            <div className="h-24"></div>
        </div>
    );
}
