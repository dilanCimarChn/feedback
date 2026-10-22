import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

// Cargar variables de entorno desde .env en desarrollo
dotenv.config();

// Funciones serverless disponibles en /api (mismo nombre que el archivo)
const RUTAS_API = ['evaluar', 'analizar-marca'];

export default defineConfig({
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
          req.on('data', chunk => {
            bodyData += chunk;
          });

          req.on('end', async () => {
            try {
              req.body = bodyData ? JSON.parse(bodyData) : {};
            } catch {
              req.body = {};
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
              const { default: handler } = await import(
                `${pathToFileURL(resolve('api', `${nombre}.js`)).href}?t=${Date.now()}`
              );
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
