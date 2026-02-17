<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma" alt="Prisma"/>
  <img src="https://img.shields.io/badge/AI-Groq-4F46E5?logo=ai" alt="Groq AI"/>
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License"/>
</p>

# ✨ AIDraft — Generador Inteligente de Documentos Académicos

**AIDraft** es una aplicación web full-stack que automatiza la creación de documentos académicos (tareas, exámenes, trabajos) a partir de un enunciado en PDF o texto. Sube tu enunciado, selecciona una plantilla, y la IA genera las respuestas automáticamente. Edita, personaliza la portada, y exporta a **Word (.docx)** con un solo clic.

---

## 🎯 ¿Qué problema resuelve?

Los estudiantes invierten mucho tiempo en:
- Copiar enunciados manualmente a un documento Word.
- Dar formato a la portada, índice, encabezados y pie de página.
- Estructurar las respuestas siguiendo plantillas específicas del centro.

**AIDraft automatiza todo este proceso**: desde la lectura del PDF hasta la exportación final en Word, pasando por la generación de respuestas con IA.

---

## 🚀 Flujo de la Aplicación

```
📄 Subir enunciado    →    🧠 IA genera respuestas    →    ✏️ Editar y revisar    →    📥 Exportar DOCX
   (PDF o texto)              (Groq / OpenAI)                (Editor rico)              (Portada + Índice)
```

### 1. 📤 Subir Enunciado (`/app/upload`)
- Arrastra o selecciona un **PDF** o **TXT** con el enunciado.
- También puedes **pegar el texto** directamente.
- El parser extrae las preguntas automáticamente detectando patrones como `RA04_a`, `Pregunta 1`, `Actividad 2`, etc.

### 2. 🎨 Seleccionar Plantilla
Elige entre dos plantillas:
| Plantilla | Descripción |
|---|---|
| **Instituto FOC** | Plantilla oficial con logo, portada formal (CICLO, Asignatura, Alumno, DNI) y disclaimer legal. |
| **Crear mi propia plantilla** | Plantilla libre con título editable, sin logo. Ideal para trabajos personalizados. |

### 3. 🧠 Editor con IA (`/app/editor`)
- Cada pregunta detectada aparece como una **tarjeta editable**.
- Pulsa **"Preguntar a la IA"** en cada pregunta para generar una respuesta automática.
- O pulsa **"Generar Todo"** para responder todas las preguntas de golpe.
- Editor con **formato rico**: negrita, cursiva, listas, encabezados.
- Panel lateral de **contexto**: añade notas, rúbrica de evaluación, y archivos adjuntos para mejorar las respuestas de la IA.
- **Autoguardado** cada 1.5 segundos.
- **Validar Contenido**: marca todas las preguntas como completas para ir directo a exportar (útil para plantillas rápidas).

### 4. 👁️ Previsualizar (`/app/preview`)
- Vista previa del documento con portada editable en tiempo real.
- **Campos editables inline**: título, subtítulo, asignatura, alumno, DNI — con bordes que aparecen al pasar el ratón.
- Los cambios se guardan en el navegador y se envían al exportar.

### 5. 📥 Exportar a Word
- Genera un archivo **.docx** profesional con:
  - Portada completa (logo para FOC, título centrado para Custom).
  - Índice automático.
  - Preguntas y respuestas formateadas.
  - Encabezados y estructura limpia.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, TailwindCSS 4 |
| **Backend** | Next.js API Routes (App Router) |
| **Base de Datos** | SQLite via Prisma ORM |
| **Autenticación** | NextAuth v5 (credenciales + bcrypt) |
| **IA** | Groq SDK (Llama / Mixtral), OpenAI compatible |
| **Parsing PDF** | pdf-parse v2 (pdfjs-dist) |
| **Parsing Word** | mammoth.js |
| **Export DOCX** | docx.js |
| **OCR** | tesseract.js (imágenes) |

---

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # NextAuth — login/registro
│   │   ├── documents/     # CRUD documentos + generación IA
│   │   ├── export/[id]/   # Exportación a DOCX
│   │   └── parse/         # Parsing de PDF/TXT/DOCX/imágenes
│   ├── app/
│   │   ├── editor/        # Editor de preguntas y respuestas
│   │   ├── preview/       # Vista previa con portada editable
│   │   ├── upload/        # Subida de enunciados
│   │   └── layout.tsx     # Layout con dock lateral
│   ├── login/             # Página de login
│   ├── globals.css        # Estilos globales + variables CSS
│   └── layout.tsx         # Layout raíz
prisma/
├── schema.prisma          # Modelos: User, Project, Document, DocumentVersion
└── dev.db                 # Base de datos SQLite (desarrollo)
```

---

## 📊 Modelo de Datos

```
User (email, password)
  └── Project (name)
        └── Document (templateType, questions, answers, status)
              └── DocumentVersion (snapshots)
```

El documento almacena las preguntas y respuestas como JSON, lo que permite flexibilidad total en el número y tipo de preguntas.

---

## ⚡ Instalación y Uso

### Requisitos previos
- **Node.js** 20+ 
- **npm** 9+

### 1. Clonar el repositorio
```bash
git clone https://github.com/danicode-dev/AIDraft.git
cd AIDraft
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz:
```env
# Base de datos (SQLite por defecto)
DATABASE_URL="file:./dev.db"

# Autenticación
AUTH_SECRET="tu-secreto-aleatorio-aqui"

# IA (elige uno)
GROQ_API_KEY="tu-api-key-de-groq"
# OPENAI_API_KEY="tu-api-key-de-openai"  # Opcional
```

### 4. Inicializar la base de datos
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🔑 Obtener API Key de Groq (Gratuita)

1. Ve a [console.groq.com](https://console.groq.com)
2. Crea una cuenta gratuita
3. Ve a **API Keys** → **Create API Key**
4. Copia la key y pégala en tu `.env` como `GROQ_API_KEY`

> Groq ofrece un tier gratuito generoso con modelos como Llama 3 y Mixtral.

---

## 🖼️ Capturas

| Upload | Editor | Preview |
|---|---|---|
| Sube PDF o texto, elige plantilla | Genera respuestas con IA | Edita portada inline |

---

## 📜 Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (http://localhost:3000) |
| `npm run build` | Build de producción |
| `npm start` | Servidor de producción |
| `npm run db:migrate` | Ejecutar migraciones de Prisma |
| `npm run db:studio` | Abrir Prisma Studio (gestor visual de BD) |
| `npm run db:seed` | Poblar la BD con datos iniciales |

---

## 🤝 Autor

**Daniel García Ortega** — [@danicode-dev](https://github.com/danicode-dev)

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
