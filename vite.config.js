import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {cargarEntornoLocal,origenApiDesarrollo} from './api/_lib/entorno.js';
import { resolve } from 'path';

cargarEntornoLocal();

const RUTAS_API = ['evaluar', 'analizar-marca', 'tendencias', 'metricas-propias', 'plan-marketing', 'plan-automatico', 'senales-sociales', 'campanas', 'regenerar-publicacion', 'diagnostico-tscp', 'estado-apis'];

export default defineConfig(({command,isPreview})=>{
  const apiRemota=command==='serve'&&!isPreview?origenApiDesarrollo(process.env.API_REMOTA_DESARROLLO):'';
  return {
  define: {'import.meta.env.API_REMOTA_DESARROLLO': JSON.stringify(apiRemota)},
  build: {
    rollupOptions: {
      input: {
        principal: resolve('index.html'),
        privacidad: resolve('privacidad.html'),
        eliminacion: resolve('eliminacion-de-datos.html')
      }
    }
  },
  server: {
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data.local/**'] },
    proxy: apiRemota?{'/api':{
      target:apiRemota,changeOrigin:true,secure:true,proxyTimeout:70000,
      configure(proxy){proxy.on('error',(_error,_req,res)=>{
        if(res.headersSent||res.writableEnded)return;
        res.writeHead(502,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'No se pudo conectar con el backend de producción. Comprueba su disponibilidad y tu conexión.'}));
      });}
    }}:undefined
  },
  plugins: [
    react(),
    {
      name: 'serverless-api-dev-middleware',
      configureServer(server) {
        if(apiRemota)return; // En este modo las API se resuelven exclusivamente en Vercel.
        server.middlewares.use(async (req, res, next) => {
          const nombre = req.url.split('?')[0].replace(/^\/api\//, '');
          if (!req.url.startsWith('/api/')) {
            next();
            return;
          }
          if (!RUTAS_API.includes(nombre)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'La ruta de API no existe en este servidor de desarrollo.' }));
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

            // Adapta la respuesta de Node al contrato de Vercel Functions.
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
              const { default: handler } = await server.ssrLoadModule(archivo);
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
  };
});
