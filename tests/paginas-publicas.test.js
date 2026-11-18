import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import tendencias from '../api/tendencias.js';
import campanas from '../api/campanas.js';
import evaluar from '../api/evaluar.js';

const leer = ruta => readFile(new URL('../' + ruta, import.meta.url), 'utf8');
const paginas = [
  { ruta: '/privacidad', titulo: 'Política de privacidad' },
  { ruta: '/eliminacion-de-datos', titulo: 'Eliminación de datos' }
];

test('las rutas informativas tienen documentos propios legibles sin ejecutar la aplicación', async () => {
  const vercel = JSON.parse(await leer('vercel.json'));
  const app = await leer('src/App.jsx');
  for (const { ruta, titulo } of paginas) {
    const regla = vercel.rewrites.find(r => r.source === ruta);
    assert.equal(regla?.destination, ruta + '.html');
    const html = await leer(regla.destination.slice(1));
    assert.ok(html.includes('<h1>' + titulo + '</h1>'));
    assert.ok(html.includes('<title>' + titulo + ' | Agente de Feedback</title>'));
    assert.match(html, /<html lang="es">/);
    assert.ok(html.includes('href="mailto:cimardilan@gmail.com'));
    assert.ok(['<script', 'id="root"', 'localStorage', '/api/'].every(texto => !html.includes(texto)));
    for (const otra of paginas) assert.ok(html.includes('href="' + otra.ruta + '"'));
    assert.ok(app.includes('href="' + ruta + '"'));
  }
  assert.ok(!vercel.rewrites.some(r => r.source.includes('(.*)') || r.source.startsWith('/api')));
});

test('las instrucciones separan borrado local, desvinculación y solicitud manual sin pedir credenciales', async () => {
  const html = await leer('eliminacion-de-datos.html');
  assert.match(html, /Borrar lo guardado en el navegador/);
  assert.match(html, /Desvincular la app de Facebook/);
  assert.match(html, /Solicitar la eliminación al proyecto/);
  assert.match(html, /Desvincular no equivale a solicitar el borrado/);
  assert.match(html, /No envíes contraseñas, códigos de acceso, claves de API ni tokens/);
  assert.match(html, /Restablecer.*solo borra la marca/);
});

test('las páginas públicas no alteran la autorización del radar, la revisión ni las campañas', async () => {
  const nombres = ['APP_ACCESS_CODE', 'EQUIPO_CODIGO_ACCESO'];
  const anteriores = Object.fromEntries(nombres.map(k => [k, process.env[k]]));
  const original = globalThis.fetch;
  try {
    process.env.APP_ACCESS_CODE = 'codigo-solo-de-prueba';
    process.env.EQUIPO_CODIGO_ACCESO = 'equipo-solo-de-prueba';
    globalThis.fetch = async () => { throw new Error('Un rechazo de acceso no consulta proveedores'); };
    for (const [handler, body] of [[tendencias, {tema:'educación',pais:'BO'}], [evaluar, {}], [campanas, {accion:'listar'}]]) {
      const res = {status(c) { this.code = c; return this; }, json(d) { this.data = d; return this; }};
      await handler({method:'POST',headers:{},body}, res);
      assert.equal(res.code, 401);
      assert.equal(res.data.codigoRequerido, true);
    }
  } finally {
    globalThis.fetch = original;
    for (const [k,v] of Object.entries(anteriores)) v === undefined ? delete process.env[k] : process.env[k] = v;
  }
});
