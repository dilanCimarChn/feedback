import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {cargarEntornoLocal} from './api/_lib/entorno.js';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { statSync } from 'node:fs';

// Cargar variables de entorno desde .env en desarrollo
cargarEntornoLocal();

// Funciones serverless disponibles en /api (mismo nombre que el archivo)
const RUTAS_API = ['evaluar', 'analizar-marca', 'tendencias', 'metricas-propias', 'plan-marketing', 'plan-automatico', 'senales-sociales', 'campanas', 'regenerar-publicacion'];

export default defineConfig({
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data.local/**'] } },
  plugins: [
    react(),
    {
      name: 'serverless-api-dev-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const nombre = req.url.split('?')[0].replace(/^\/api\//, '');
          if (!req.url.startsWith('/api/') || !RUTAS_API.includes(nombre)) {
            next();
            return;
          }

          let bodyData = '';
          let bytes = 0, demasiadoGrande = false;
          req.on('data', chunk => {
            bytes += chunk.length;
            if (bytes > 4 * 1024 * 1024) { demasiadoGrande = true; bodyData = ''; return; }
            bodyData += chunk;
          });

          req.on('end', async () => {
            if (demasiadoGrande) {
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'La solicitud supera los 4 MB.' }));
              return;
            }
            try {
              req.body = bodyData ? JSON.parse(bodyData) : {};
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'El cuerpo debe ser JSON válido.' }));
              return;
            }

            // Polyfill de métodos de respuesta para compatibilidad con Vercel Functions
            res.status = code => {
              res.statusCode = code;
              return res;
            };
            res.json = data => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };

            try {
              const archivo = resolve('api', `${nombre}.js`);
              const { default: handler } = await import(`${pathToFileURL(archivo).href}?t=${statSync(archivo).mtimeMs}`);
              await handler(req, res);
            } catch (err) {
              console.error(`Error ejecutando api/${nombre} en dev middleware:`, err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Error en middleware de API', detalle: err.message }));
            }
          });
        });
      }
    }
  ]
});
