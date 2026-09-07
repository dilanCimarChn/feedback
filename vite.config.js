import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env en desarrollo
dotenv.config();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serverless-api-dev-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url.split('?')[0];
          if (url === '/api/evaluar') {
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.statusCode = 200;
              res.end();
              return;
            }

            if (req.method === 'POST') {
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
                  const { default: handler } = await import('./api/evaluar.js');
                  await handler(req, res);
                } catch (err) {
                  console.error('Error ejecutando api/evaluar en dev middleware:', err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Error en middleware de API', detalle: err.message }));
                }
              });
              return;
            }
          }
          next();
        });
      }
    }
  ]
});
