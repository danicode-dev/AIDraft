
const fs = require('fs');
const mammoth = require('mammoth');

const filePath = "c:\\Users\\danga\\.gemini\\antigravity\\playground\\APLICACIONPROPIA\\docututor\\P30-Plantilla_Informe_Elaboracion_Tarea_ia.docx";

mammoth.extractRawText({ path: filePath })
    .then(function (result) {
        const text = result.value; // The raw text
        console.log(text);
    })
    .catch(function (err) {
        console.error(err);
    });
