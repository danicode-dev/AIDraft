# IDraft — Generador Inteligente de Documentos Académicos

AIDraft es una aplicación web full-stack que automatiza la creación de documentos académicos (tareas, exámenes, trabajos) a partir de un enunciado en PDF o texto. Sube tu enunciado, selecciona una plantilla, y la IA genera las respuestas automáticamente. Edita, personaliza la portada, y exporta a Word (.docx) con un solo clic.

## 🎯 ¿Qué problema resuelve?

En el entorno educativo actual, los docentes dedican una cantidad significativa de tiempo a tareas repetitivas y administrativas, como la creación de formatos, rúbricas y la estructuración de documentos base para sus clases. 

**IDraft** elimina esta carga de trabajo manual. Al transformar automáticamente la documentación técnica o los enunciados en bruto en materiales didácticos listos para usar, permite a los profesores centrarse en lo más importante: la calidad de la enseñanza y la atención a sus alumnos. Reduce horas de maquetación y redacción a simples segundos de procesamiento.

## 🔄 Flujo de la Aplicación

1.  **Inicio de Sesión**: Acceso seguro a la plataforma mediante credenciales.
2.  **Subida de Documentos**: El usuario carga un archivo (PDF o TXT) con el contenido base o el enunciado de la tarea.
3.  **Selección de Plantilla**: Se elige el tipo de documento a generar (ej. FOC, Genérico) según las necesidades.
4.  **Procesamiento IA**: El sistema analiza el texto, extrae los puntos clave y genera una estructura pedagógica completa (contexto, tareas, rúbrica).
5.  **Edición en Vivo**: El docente revisa el borrador generado en un editor de texto enriquecido, ajustando el contenido si es necesario.
6.  **Exportación**: Con un solo clic, se descarga el documento final en formato Word (.docx), perfectamente maquetado y listo para entregar.

## 🛠️ Stack Tecnológico

Este proyecto ha sido desarrollado utilizando las tecnologías más modernas del ecosistema web para garantizar rendimiento, escalabilidad y una excelente experiencia de usuario:

| Tecnología | Descripción |
|------------|-------------|
| **Next.js 16** | Framework React de última generación para frontend y backend (App Router). |
| **TypeScript** | Superset de JavaScript que añade tipado estático para un código más robusto. |
| **Prisma** | ORM moderno para la gestión de la base de datos y migraciones. |
| **PostgreSQL / SQLite** | Base de datos relacional (SQLite en local, PostgreSQL en producción). |
| **NextAuth.js** | Sistema completo de autenticación y gestión de sesiones. |
| **Groq SDK** | Integración de Inteligencia Artificial para el procesamiento de lenguaje natural. |
| **Tailwind CSS** | Framework de utilidades CSS para un diseño rápido y responsive. |
| **Zod** | Librería de validación de esquemas y tipos en tiempo de ejecución. |

## 📂 Estructura del Proyecto

La arquitectura del proyecto sigue las mejores prácticas de Next.js, manteniendo una separación clara de responsabilidades:

```bash
/src
  /app          # Rutas, páginas y lógica del servidor (App Router)
    /api        # Endpoints de la API interna (Auth, Parsing, AI)
    /app        # Vistas protegidas de la aplicación (Dashboard, Editor)
    /login      # Vista pública de autenticación
  /components   # Biblioteca de componentes UI reutilizables
  /lib          # Utilidades, configuración de Prisma y funciones auxiliares
/prisma         # Esquema de base de datos y seeds
/public         # Activos estáticos
```

## 🗄️ Modelo de Datos

El sistema utiliza un modelo relacional eficiente gestionado por Prisma:

-   **User**: Gestiona la identidad y credenciales de los usuarios.
-   **Project**: Agrupa los documentos creados por un usuario.
-   **Document**: Núcleo de la aplicación. Almacena el texto fuente, las configuraciones, el estado del borrador y el contenido generado (JSON).
-   **DocumentVersion**: Historial de cambios y versiones de los documentos.

## 🚀 Instalación Gratuita

Puedes ejecutar este proyecto en tu máquina local para desarrollo o pruebas:

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/danicode-dev/AIDraft.git
    cd AIDraft
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar entorno**:
    Crea un archivo `.env` basado en el ejemplo proporcionado y configura tu base de datos local.

4.  **Inicializar base de datos**:
    ```bash
    npx prisma migrate dev
    npx tsx prisma/seed.ts
    ```

5.  **Iniciar servidor**:
    ```bash
    npm run dev
    ```
    Accede a `http://localhost:3000`.

## Autor

**Diseñado y desarrollado por Daniel García** 👨‍💻  
Si te ha gustado, no olvides darle una ⭐️ al repositorio.

[GitHub](https://github.com/danicode-dev) | [LinkedIn](https://www.linkedin.com/in/daniel-garcia-dev/)
