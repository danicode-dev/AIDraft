
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    PageBreak,
    TableOfContents,
    StyleLevel,
    ImageRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
    TextWrappingType,
    TextWrappingSide,
    VerticalAlign,
    Header,
    Footer,
} from "docx";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id } = await params;

        // Get export metadata from request body
        const body = await request.json().catch(() => ({}));
        console.log("DOCUMENT EXPORT DEBUG - Request Body:", body);
        const { asignatura, tema, apellidos, nombre, dni, coverTitulo, coverSubtitulo } = body;

        // Get document
        const doc = await prisma.document.findFirst({
            where: {
                id,
                project: { ownerId: session.user.id },
            },
            include: { project: true },
        });

        if (!doc) {
            console.error("DOCUMENT EXPORT DEBUG - Document not found", { id, userId: session.user.id });
            return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
        }

        console.log("DOCUMENT EXPORT DEBUG - Document found:", {
            id: doc.id,
            templateType: doc.templateType,
            questionsLength: doc.questionsJson?.length,
        });

        const questions: string[] = JSON.parse(doc.questionsJson);
        const answers: Record<number, string> = JSON.parse(doc.answersJson);
        // Case insensitive FOC check
        const isFOC = doc.templateType?.toUpperCase().includes("FOC");
        const isCustom = doc.templateType?.toUpperCase().includes("CUSTOM");
        console.log("DOCUMENT EXPORT DEBUG - isFOC:", isFOC, "isCustom:", isCustom);

        // Extract RA code from question (Synced with Parser)
        const extractRA = (question: string): string | null => {
            // Match "RA04_a", "(RA04_a)", "R.A. 4.a", etc.
            const match1 = question.match(/\(?(RA\d+_[a-z])\)?/i);
            if (match1) return match1[1].toUpperCase();

            // Match loose pattern "R.A. 4.a" -> try to normalize to RA04_a? 
            // Or just return the "RA..." part found.
            const match2 = question.match(/(R\.?A\.?\s*\d+[\._]\w+)/i);
            if (match2) return match2[1].replace(/[\.\s]/g, "").toUpperCase();

            return null;
        };

        // Group questions by RA code
        const groupedByRA: Record<string, { question: string; answer: string; index: number }[]> = {};
        questions.forEach((q, i) => {
            const ra = extractRA(q) || "OTROS / RA NO ESPECIFICADO";
            if (!groupedByRA[ra]) {
                groupedByRA[ra] = [];
            }
            groupedByRA[ra].push({
                question: q,
                answer: answers[i] || "",
                index: i,
            });
        });

        // Type definition update
        let footerBuffer: Buffer | null = null;
        try {
            const footerPath = path.join(process.cwd(), "public", "assets", "foc", "footer_wave.png");
            if (fs.existsSync(footerPath)) {
                footerBuffer = fs.readFileSync(footerPath);
            }
        } catch (e) {
            console.error("Error loading footer:", e);
        }

        const children: (Paragraph | Table)[] = [];

        // ========== COVER PAGE ==========
        if (isFOC) {
            // Use values from request body (from export modal)
            const subjectText = (asignatura || "ASIGNATURA").toUpperCase();
            const topicText = (tema || "TEMA").toUpperCase();
            const alumnoNombre = nombre || "NOMBRE";
            const alumnoApellidos = apellidos || "APELLIDOS";
            const alumnoDni = dni || "DNI";

            // Load Logo
            let logoBuffer: Buffer | null = null;
            try {
                const logoPath = path.join(process.cwd(), "public", "assets", "foc", "image1.png");
                if (fs.existsSync(logoPath)) {
                    logoBuffer = fs.readFileSync(logoPath);
                }
            } catch (e) {
                console.error("Error loading logo:", e);
            }



            // Header Table: [Logo] | [Cycle/Course Info]
            const headerTable = new Table({
                width: {
                    size: 100,
                    type: WidthType.PERCENTAGE,
                },
                borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                    insideVertical: { style: BorderStyle.NONE },
                    insideHorizontal: { style: BorderStyle.NONE },
                },
                rows: [
                    new TableRow({
                        children: [
                            // Cell 1: Logo
                            new TableCell({
                                width: { size: 50, type: WidthType.PERCENTAGE },
                                children: [
                                    new Paragraph({
                                        children: logoBuffer
                                            ? [
                                                new ImageRun({
                                                    data: logoBuffer,
                                                    transformation: {
                                                        width: 150,
                                                        height: 150,
                                                    },
                                                    type: "png", // Required by library
                                                }),
                                            ]
                                            : [new TextRun("[LOGO]")],
                                    }),
                                ],
                            }),
                            // Cell 2: Metadata
                            new TableCell({
                                width: { size: 50, type: WidthType.PERCENTAGE },
                                verticalAlign: "center",
                                children: [
                                    new Paragraph({
                                        alignment: AlignmentType.RIGHT,
                                        children: [
                                            new TextRun({
                                                text: "CICLO: DAW",
                                                bold: true,
                                                font: "Calibri",
                                                size: 40,
                                                color: "004785",
                                            }),
                                        ],
                                    }),
                                    new Paragraph({
                                        alignment: AlignmentType.RIGHT,
                                        children: [
                                            new TextRun({
                                                text: subjectText,
                                                bold: true,
                                                font: "Calibri",
                                                size: 40,
                                                color: "004785",
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            });

            children.push(headerTable);

            // Spacing (reduced for better fit)
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: "", break: 2 })],
                })
            );

            // 2. Center: TITLE (custom or generated)
            const titleText = coverTitulo || `${subjectText} Y ${topicText}`;
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: titleText.toUpperCase(),
                            bold: true,
                            font: "Arial",
                            size: 80, // 40pt
                            color: "004785",
                        }),
                    ],
                    spacing: { before: 1500, after: 1500 }, // Reduced for fit
                }),
                new Paragraph({
                    children: [new TextRun({ text: "", break: 2 })],
                })
            );

            // 3. Bottom Right: Student Name
            const studentNameParts = [alumnoApellidos, alumnoNombre].filter(p => p && p !== "APELLIDOS" && p !== "NOMBRE");
            const studentNameText = studentNameParts.length > 0 ? studentNameParts.join(" ").toUpperCase() : "APELLIDOS NOMBRE";

            children.push(
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({
                            text: "Alumno:",
                            bold: true,
                            font: "Arial",
                            size: 56, // 28pt
                            color: "004785",
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({
                            text: studentNameText,
                            bold: true,
                            font: "Arial",
                            size: 56, // 28pt
                            color: "004785",
                        }),
                    ],
                }),
            );

            if (alumnoDni && alumnoDni !== "DNI") {
                children.push(
                    new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                            new TextRun({
                                text: alumnoDni.toUpperCase(),
                                bold: true,
                                font: "Arial",
                                size: 56,
                                color: "004785",
                            }),
                        ],
                    })
                );
            }

            // Footer removed - user will add custom one

            children.push(
                new Paragraph({
                    children: [new PageBreak()],
                })
            );

            // ========== PAGE 2: LEGAL DISCLAIMER ==========
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: "", break: 10 })], // Push to bottom
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({
                            text: "Los documentos, elementos gráficos, vídeos, transparencias y otros recursos didácticos incluidos en este contenido pueden contener imprecisiones técnicas o errores tipográficos. Periódicamente se realizan cambios en el contenido. Fomento Ocupacional FOC SL puede realizar en cualquier momento, sin previo aviso, mejoras y/o cambios en el contenido.",
                            size: 18, // 9pt
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({
                            text: "Es responsabilidad del usuario el cumplimiento de todas las leyes de derechos de autor aplicables. Ningún elemento de este contenido (documentos, elementos gráficos, vídeos, transparencias y otros recursos didácticos asociados), ni parte de este contenido puede ser reproducida, almacenada o introducida en un sistema de recuperación, ni transmitida de ninguna forma ni por ningún medio (ya sea electrónico, mecánico, por fotocopia, grabación o de otra manera), ni con ningún propósito, sin la previa autorización por escrito de Fomento Ocupacional FOC SL.",
                            size: 18,
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({
                            text: "Este contenido está protegido por la ley de propiedad intelectual e industrial. Pertenecen a Fomento Ocupacional FOC SL los derechos de autor y los demás derechos de propiedad intelectual e industrial sobre este contenido.",
                            size: 18,
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    children: [
                        new TextRun({
                            text: "Sin perjuicio de los casos en que la ley aplicable prohíbe la exclusión de la responsabilidad por daños, Fomento Ocupacional FOC SL no se responsabiliza en ningún caso de daños indirectos, sean cuales fueren su naturaleza u origen, que se deriven o de otro modo estén relacionados con el uso de este contenido.",
                            size: 18,
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "© 2022 Fomento Ocupacional FOC SL todos los derechos reservados.",
                            size: 18,
                            italics: true,
                        }),
                    ],
                }),
                new Paragraph({
                    children: [new PageBreak()],
                })
            );
        }

        // ========== CUSTOM TEMPLATE COVER ==========
        if (isCustom) {
            const titleText = (coverTitulo || "TITULO DEL DOCUMENTO").toUpperCase();
            const authorText = nombre || "";

            // Spacing before title
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: "", break: 6 })],
                })
            );

            // Big centered title
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: titleText,
                            bold: true,
                            font: "Arial",
                            size: 80,
                            color: "30475E",
                        }),
                    ],
                    spacing: { before: 2000, after: 600 },
                })
            );

            // Subtitle if provided
            if (coverSubtitulo) {
                children.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: coverSubtitulo,
                                font: "Arial",
                                size: 36,
                                color: "666666",
                            }),
                        ],
                        spacing: { after: 1500 },
                    })
                );
            }

            // Author name (bottom right)
            if (authorText) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: "", break: 4 })],
                    }),
                    new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                            new TextRun({
                                text: authorText,
                                bold: true,
                                font: "Arial",
                                size: 32,
                                color: "30475E",
                            }),
                        ],
                    })
                );
            }

            // Page break after cover
            children.push(
                new Paragraph({
                    children: [new PageBreak()],
                })
            );
        }

        // ========== TABLE OF CONTENTS (Manual Placeholder) ==========
        children.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [
                    new TextRun({
                        text: "Índice",
                        bold: true,
                    }),
                ],
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: "(Actualizar índice al finalizar)",
                        italics: true,
                        size: 20,
                        color: "888888",
                    }),
                ],
            }),
            new Paragraph({
                children: [new TextRun({ text: "", break: 1 })],
            })
        );

        // Add TOC entries manually (Simple list matching Template)
        const raKeys = Object.keys(groupedByRA).sort();
        raKeys.forEach((ra, i) => {
            // Group header in TOC? Or just list items? 
            // Template shows: (RA02_a) Question Text ... Page
            // So we iterate through ALL questions in this RA
            groupedByRA[ra].forEach((item, idx) => {
                children.push(
                    new Paragraph({
                        style: "Sumario1",
                        children: [
                            new TextRun({
                                text: `${item.question} `, // Include FULL question text
                            }),
                            new TextRun({
                                text: `................................................ (pág. manual)`,
                                color: "CCCCCC",
                            }),
                        ],
                        spacing: { after: 120 },
                    })
                );
            });
        });

        children.push(
            new Paragraph({
                children: [new PageBreak()],
            })
        );

        // ========== CONTENT BY RA SECTIONS ==========
        raKeys.forEach((ra) => {
            // RA Section Header
            children.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [
                        new TextRun({
                            text: ra,
                            bold: true,
                            color: "004785",
                        }),
                    ],
                }),
                new Paragraph({
                    children: [new TextRun({ text: "", break: 1 })],
                })
            );

            // Questions in this RA
            groupedByRA[ra].forEach((item) => {
                // Question heading
                children.push(
                    new Paragraph({
                        style: "Titulo1",
                        children: [
                            new TextRun({
                                text: item.question,
                            }),
                        ],
                    })
                );

                // Answer - parse HTML for formatting (bold, italic, underline)
                if (item.answer) {
                    const parseHtmlToRuns = (html: string): Paragraph[] => {
                        const paragraphs: Paragraph[] = [];
                        // Split into block-level chunks (by <br>, <p>, <div>, newlines)
                        const blocks = html
                            .replace(/<\/?(p|div|br\s*\/?)\s*>/gi, "\n")
                            .replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, "\n$1\n")
                            .split("\n");

                        for (const block of blocks) {
                            const trimmed = block.trim();
                            if (trimmed === "") continue;

                            const runs: TextRun[] = [];
                            // Parse inline formatting: <b>/<strong>, <i>/<em>, <u>
                            let remaining = trimmed;
                            // Regex to find HTML tags
                            const tagRegex = /<(\/?)(\w+)[^>]*>/g;
                            let lastIndex = 0;
                            let bold = false;
                            let italic = false;
                            let underlined = false;
                            let match;

                            // Collect segments
                            const segments: { text: string; bold: boolean; italic: boolean; underline: boolean }[] = [];

                            while ((match = tagRegex.exec(remaining)) !== null) {
                                // Text before this tag
                                if (match.index > lastIndex) {
                                    const text = remaining.substring(lastIndex, match.index).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
                                    if (text) {
                                        segments.push({ text, bold, italic, underline: underlined });
                                    }
                                }

                                const isClosing = match[1] === "/";
                                const tag = match[2].toLowerCase();

                                if (tag === "b" || tag === "strong") bold = !isClosing;
                                else if (tag === "i" || tag === "em") italic = !isClosing;
                                else if (tag === "u") underlined = !isClosing;

                                lastIndex = match.index + match[0].length;
                            }

                            // Remaining text after last tag
                            if (lastIndex < remaining.length) {
                                const text = remaining.substring(lastIndex).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
                                if (text) {
                                    segments.push({ text, bold, italic, underline: underlined });
                                }
                            }

                            // If no segments parsed, just add the raw text
                            if (segments.length === 0) {
                                const cleanText = trimmed.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
                                if (cleanText) {
                                    segments.push({ text: cleanText, bold: false, italic: false, underline: false });
                                }
                            }

                            for (const seg of segments) {
                                runs.push(new TextRun({
                                    text: seg.text,
                                    bold: seg.bold || undefined,
                                    italics: seg.italic || undefined,
                                    underline: seg.underline ? {} : undefined,
                                }));
                            }

                            if (runs.length > 0) {
                                paragraphs.push(new Paragraph({
                                    style: "TextoUser",
                                    children: runs,
                                    spacing: { after: 100 },
                                }));
                            }
                        }

                        return paragraphs;
                    };

                    const answerParagraphs = parseHtmlToRuns(item.answer);
                    children.push(...answerParagraphs);
                } else {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "[Respuesta pendiente]",
                                    italics: true,
                                    color: "999999",
                                }),
                            ],
                        })
                    );
                }

                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: "", break: 1 })],
                    })
                );
            });
        });

        // Create document
        const docx = new Document({
            styles: {
                paragraphStyles: [
                    {
                        id: "Normal",
                        name: "Normal",
                        run: {
                            font: "Calibri",
                            size: 24, // 12pt
                        },
                    },
                    {
                        id: "Sumario1",
                        name: "Sumario 1",
                        basedOn: "Normal",
                        run: {
                            font: "Calibri",
                            size: 22, // 11pt
                        },
                    },
                    {
                        id: "Titulo1",
                        name: "Título 1",
                        basedOn: "Normal",
                        next: "Normal",
                        run: {
                            font: "Cambria",
                            size: 32, // 16pt
                            bold: true,
                            color: "004785",
                        },
                    },
                    {
                        id: "TextoUser",
                        name: "Texto (user)",
                        basedOn: "Normal",
                        run: {
                            font: "Arial",
                            size: 26, // 13pt
                        },
                    },
                ],
            },
            sections: [
                {
                    children,
                    headers: {
                        default: new Header({
                            children: [], // Clean header for subsequent pages if needed
                        }),
                    },
                    footers: {
                        first: footerBuffer
                            ? new Footer({
                                children: [
                                    new Paragraph({
                                        children: [
                                            new ImageRun({
                                                data: footerBuffer,
                                                transformation: {
                                                    width: 794, // Full A4 width in pixels (21cm at 96dpi)
                                                    height: 1123, // Full A4 height in pixels (29.7cm at 96dpi)
                                                },
                                                floating: {
                                                    horizontalPosition: {
                                                        relative: HorizontalPositionRelativeFrom.PAGE,
                                                        offset: 0, // Start from left edge of page
                                                    },
                                                    verticalPosition: {
                                                        relative: VerticalPositionRelativeFrom.PAGE,
                                                        offset: 0, // Start from top of page
                                                    },
                                                    behindDocument: true, // Place behind text
                                                },
                                                type: "png",
                                            }),
                                        ],
                                    }),
                                ],
                            })
                            : undefined,
                    },
                    properties: {
                        titlePage: true, // Enable distinct first page
                        page: {
                            margin: {
                                top: 1000,
                                right: 1000,
                                bottom: 1000,
                                left: 1000,
                            },
                        },
                    },
                },
            ],
        });

        // Generate buffer
        const buffer = await Packer.toBuffer(docx);

        // Return as downloadable file (convert Buffer to Uint8Array for NextResponse)
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename = "AIDraft_Tarea_${new Date().toISOString().slice(0, 10)}.docx"`,
            },
        });
    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json({ error: "Error al exportar el documento" }, { status: 500 });
    }
}
