# Agente de Feedback - Auditoría de Contenido con IA

Sistema inteligente de control de calidad y auditoría de marca para publicaciones en redes sociales (Feed, Reels y Carruseles), impulsado por **React 19 + Vite** y la API multimodal de **Google Gemini**.

---

## Características

- **Evaluación Multimodal**: Analiza tanto texto (copy) como imagen (portada/arte) simultáneamente.
- **Detección por Formato**:
  - **Post (1:1 / 4:5)**: Márgenes de seguridad y alineación con objetivos.
  - **Reel (9:16)**: Verificación estricta de zonas de seguridad de interfaz (libres los 220px inferiores y 120px laterales).
  - **Carrusel**: Validación obligatoria de llamados a la acción (CTA) para deslizar o guardar.
- **Validación de Identidad de Marca**: Reglas de márgenes, colores corporativos, tono de voz, tipografía y gramática.
- **Backend Serverless Seguro**: La API key de Gemini nunca se expone en el cliente; corre en Vercel Serverless Functions (`/api/evaluar`).

---

## Tecnologías

- **Frontend**: React 19, Vite, CSS moderno.
- **Backend / Serverless**: Node.js, Vercel Serverless Functions.
- **IA**: Google Gemini 2.5 Flash / 2.0 Flash (vía Google Generative Language API).

---

## Configuración Local

1. Clona el repositorio:
   ```bash
   git clone https://github.com/dilanCimarChn/feedback.git
   cd feedback
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` en la raíz con tu clave de Gemini:
   ```env
   GEMINI_API_KEY=tu_api_key_de_gemini
   ```

4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

---

## Despliegue en Vercel

1. Importa el repositorio en [Vercel](https://vercel.com).
2. En la sección **Environment Variables**, añade:
   - `GEMINI_API_KEY`: tu clave de API de Gemini.
3. Haz clic en **Deploy**.
