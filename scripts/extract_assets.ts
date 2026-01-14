
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";

const DOCX_PATH = path.join(process.cwd(), "P30-Plantilla_Informe_Elaboracion_Tarea_ia.docx");
const OUTPUT_DIR = path.join(process.cwd(), "public", "assets", "foc");

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

try {
    const zip = new AdmZip(DOCX_PATH);
    const zipEntries = zip.getEntries();

    zipEntries.forEach((entry) => {
        if (entry.entryName.startsWith("word/media/")) {
            const fileName = path.basename(entry.entryName);
            const targetPath = path.join(OUTPUT_DIR, fileName);
            fs.writeFileSync(targetPath, entry.getData());
            console.log(`Extracted: ${fileName}`);
        }
    });
    console.log("Extraction complete.");
} catch (e) {
    console.error("Error extracting zip:", e);
}
