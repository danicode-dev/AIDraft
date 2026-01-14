# DocuTutor MVP

**Generador de borradores de tareas con exportación a Word (.docx) siguiendo plantilla FOC.**

Aplicación web privada para subir enunciados (PDF/DOCX/TXT), detectar preguntas automáticamente, editar respuestas, y exportar documentos Word con formato profesional.

## 🚀 Quick Start

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Crear base de datos y seed
npx prisma migrate dev --name init
npm run db:seed

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abre http://localhost:3000 en tu navegador.

## 🔐 Credenciales por defecto

- **Email:** `admin@docututor.com`
- **Password:** `admin123`

*(Definidas en `.env.example` - cambiar en producción)*

## 📦 Tecnologías

- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes
- **Auth:** NextAuth v5 (Credentials)
- **DB:** SQLite + Prisma ORM
- **Parsing:** pdf-parse, mammoth
- **Export:** docx library

## 📁 Estructura

```
src/
├── app/
│   ├── (protected)/        # Rutas protegidas
│   │   ├── upload/         # Subir enunciado
│   │   ├── editor/         # Editar respuestas
│   │   └── preview/        # Previsualizar y exportar
│   ├── api/
│   │   ├── auth/           # NextAuth endpoints
│   │   ├── parse/          # Extracción de texto
│   │   ├── documents/      # CRUD documentos
│   │   └── export/         # Generación .docx
│   └── login/              # Página de login
├── lib/
│   ├── auth.ts             # Configuración NextAuth
│   └── prisma.ts           # Cliente Prisma
prisma/
├── schema.prisma           # Modelo de datos
└── seed.ts                 # Seed del admin
```

## 🛠 Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Iniciar producción |
| `npm run lint` | Verificar código |
| `npm run db:seed` | Seed de usuario admin |
| `npm run db:studio` | Abrir Prisma Studio |

## 📋 Variables de Entorno

Copia `.env.example` a `.env` y configura:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="cambiar-en-produccion"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_EMAIL="admin@docututor.com"
ADMIN_PASSWORD="admin123"
```

## 🔄 Flujo de Uso

1. **Login** → Autenticación con email/password
2. **Upload** → Subir PDF/DOCX/TXT con enunciado
3. **Editor** → Revisar preguntas detectadas, editar respuestas (autosave)
4. **Preview** → Ver documento final
5. **Export** → Descargar .docx con formato FOC

## 🧪 Cómo Probar las Funcionalidades

### Test 1: Exportar DOCX
1. Navega a Preview con un documento que tenga respuestas
2. Haz clic en "Descargar Word (.docx)"
3. ✅ Aparece modal para elegir nombre de archivo
4. ✅ El archivo se descarga correctamente

### Test 2: Generación IA (Múltiples Preguntas)
1. Sube un documento con 3+ preguntas
2. Ve a la pestaña "Contexto IA" y pega el temario
3. Haz clic en "Preguntar a IA" en pregunta 1, 2 y 3
4. ✅ Cada pregunta recibe respuesta diferente y relevante

### Test 3: Selector de Nombre de Archivo
1. En Preview, haz clic en exportar
2. ✅ Aparece formulario con Asignatura, Apellidos, Nombre, DNI, Tema
3. ✅ El nombre se genera automáticamente
4. ✅ Los datos se guardan en localStorage para futuras descargas
5. ✅ Caracteres inválidos se eliminan automáticamente

## 📄 Formato del .docx Exportado

- **Portada** estilo FOC (título, alumno, fecha)
- **Índice** de contenidos por secciones RA
- **Secciones** agrupadas por código RA (RA02_a, RA02_b, etc.)
- **Preguntas/Respuestas** con formato profesional

## 📝 Licencia

MIT © 2026
