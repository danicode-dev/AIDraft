# DocuTutor - Guía de Instalación Rápida

Esta guía está pensada para ejecutar el proyecto en otro ordenador desde cero.

## 📋 Requisitos Previos

Antes de empezar, necesitas tener instalado:

1.  **Node.js**: Descarga e instala la versión "LTS" desde [nodejs.org](https://nodejs.org/).
2.  (Opcional) **VS Code**: Un editor de código para ver el proyecto.

---

## 🚀 Cómo Ejecutar el Proyecto (Paso a Paso)

Si te han pasado este proyecto en un archivo `.zip`, sigue estos pasos:

### 1. Preparar la carpeta
1.  Descomprime el archivo `.zip` en una carpeta de tu ordenador (por ejemplo, en el Escritorio o Documentos).
2.  Entra en la carpeta descomprimida `docututor`.

### 2. Instalar las dependencias
1.  Haz clic derecho en un espacio vacío dentro de la carpeta y selecciona **"Abrir en Terminal"** (o abre PowerShell y navega hasta la carpeta).
2.  Escribe el siguiente comando y pulsa `Enter`:
    ```bash
    npm install
    ```
    *(Esto tardará un poco descargando librerías. Espera a que termine).*

### 3. Preparar la Base de Datos
*(Solo necesario si no tienes el archivo `dev.db` en la carpeta)*
En la misma terminal, escribe:
```bash
npm run db:migrate
```

### 4. Arrancar la Aplicación
Para encender el servidor, escribe:
```bash
npm run dev
```

Verás un mensaje que dice `Ready in ...` o `Local: http://localhost:3000`.

### 5. Usar la Aplicación
1.  Abre tu navegador (Chrome, Edge, etc.).
2.  Entra en: [http://localhost:3000](http://localhost:3000)
3.  Usa estas credenciales para entrar:
    *   **Email:** `admin@docututor.com`
    *   **Contraseña:** `admin123`

---

## 🛠 Comandos Útiles

| Comando | Para qué sirve |
|---------|----------------|
| `npm run dev` | Inicia la app (modo desarrollo) |
| `npm run db:studio` | Abre un panel para ver/editar la base de datos |
