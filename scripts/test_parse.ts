
import fs from "fs";
import path from "path";
import mammoth from "mammoth";

async function testParse() {
    const filePath = path.join(process.cwd(), "P30-Plantilla_Informe_Elaboracion_Tarea_ia.docx");

    console.log(`Reading file from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error("File not found!");
        return;
    }

    const buffer = fs.readFileSync(filePath);

    try {
        console.log("Attempting to parse with mammoth...");
        const result = await mammoth.extractRawText({ buffer });
        console.log("Parse Success!");
        console.log("Extracted Text Start:");
        console.log(result.value.slice(0, 500));
        console.log("...");
        console.log("Extracted Text End");

        if (result.messages.length > 0) {
            console.log("Messages/Warnings:", result.messages);
        }
    } catch (error) {
        console.error("Error parsing DOCX:", error);
    }
}

testParse();
