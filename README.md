# DocuTutor - Generador de Borradores Educativos

DocuTutor es una herramienta diseñada para agilizar la creación de material didáctico. Permite a los docentes subir documentación técnica (PDF, TXT) y generar borradores de tareas educativas estructuradas, incluyendo contexto, recomendaciones pedagógicas y rúbricas de evaluación, todo ello potenciado por Inteligencia Artificial.

## Características Principales

- **Análisis de Documentos**: Extracción y procesamiento de texto desde archivos PDF y TXT.
- **Generación de Contenido Pedagógico**: Creación automática de enunciados de tareas basados en la documentación aportada.
- **Editor Integrado**: Interfaz de edición de texto enriquecido para refinar el contenido generado.
- **Exportación**: Capacidad de exportar el resultado final a formato DOCX para su uso inmediato.
- **Gestión de Proyectos**: Organización de documentos por asignaturas y temas.

## Tecnologías Utilizadas

Este proyecto está construido con un stack tecnológico moderno y robusto:

| Tecnología | Propósito |
|------------|-----------|
| **Next.js 16** | Framework principal para frontend y backend (App Router). |
| **TypeScript** | Lenguaje de programación para garantizar tipado estático y escalabilidad. |
| **Prisma** | ORM para la gestión y modelado de la base de datos (SQLite / PostgreSQL). |
| **NextAuth.js** | Sistema de autenticación seguro y flexible. |
| **Groq SDK** | Integración con modelos de lenguaje (LLMs) para la generación de texto. |
| **Tailwind CSS** | Framework de estilos para un diseño de interfaz adaptable y consistente. |

## Instalación y Despliegue

### Requisitos Previos

- Node.js 18 o superior.
- Una base de datos (SQLite para desarrollo local, PostgreSQL para producción).
- Clave de API de Groq Cloud.

### Configuración Local

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/danicode-dev/AIDraft.git
    cd AIDraft
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar variables de entorno**:
    Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:
    ```env
    DATABASE_URL="file:./dev.db"
    AUTH_SECRET="tu-secreto-generado"
    GROQ_API_KEY="tu-api-key-de-groq"
    ```

4.  **Inicializar la base de datos**:
    ```bash
    npx prisma migrate dev --name init
    npx tsx prisma/seed.ts
    ```

5.  **Ejecutar en desarrollo**:
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:3000`.

### Despliegue en Vercel (Demo)

Para desplegar una versión de demostración:

1.  Conecta tu repositorio a Vercel.
2.  Configura las variables de entorno (`DATABASE_URL`, `AUTH_SECRET`, `GROQ_API_KEY`).
3.  Asegúrate de usar una base de datos PostgreSQL (como Neon o Supabase).
4.  El sistema configurará automáticamente la base de datos durante el proceso de construcción.

## Estructura del Proyecto

El código está organizado siguiendo las convenciones de Next.js:

-   `src/app`: Rutas y páginas de la aplicación.
-   `src/components`: Componentes de interfaz reutilizables.
-   `src/lib`: Utilidades, configuración de Prisma y funciones auxiliares.
-   `prisma`: Esquema de base de datos y scripts de inicialización.

## Licencia

Este proyecto es de uso privado y educativo.
