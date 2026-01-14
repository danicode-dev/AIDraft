import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');

const pdfParseLib = require("pdf-parse");
const pdf = typeof pdfParseLib === 'function' ? pdfParseLib : pdfParseLib.default;

const dataBuffer = fs.readFileSync('P30-Plantilla_Informe_Elaboracion_Tarea_ia.pdf');

pdf(dataBuffer).then(function (data: any) {
    console.log(data.text);
}).catch(console.error);
