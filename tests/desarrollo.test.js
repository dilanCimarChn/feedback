import test from 'node:test';
import assert from 'node:assert/strict';
import {origenApiDesarrollo} from '../api/_lib/entorno.js';
import {createServer} from 'vite';
import {resolve} from 'node:path';

test('el backend remoto de desarrollo solo admite un origen HTTPS sin credenciales',()=>{
  assert.equal(origenApiDesarrollo(''), '');
  assert.equal(origenApiDesarrollo('  https://feedback-sigma-one.vercel.app/  '),'https://feedback-sigma-one.vercel.app');
  for(const valor of ['http://feedback-sigma-one.vercel.app','https://usuario:clave@feedback-sigma-one.vercel.app','https://feedback-sigma-one.vercel.app/api','https://feedback-sigma-one.vercel.app/?token=prueba','https://feedback-sigma-one.vercel.app/#fragmento','no-es-url']){
    assert.throws(()=>origenApiDesarrollo(valor),/API_REMOTA_DESARROLLO debe ser el origen HTTPS/);
  }
});

test('el servidor local ejecuta la nueva ruta con configLoader runner y devuelve JSON para rutas desconocidas', async () => {
  const anterior = { remoto: process.env.API_REMOTA_DESARROLLO, codigo: process.env.APP_ACCESS_CODE };
  process.env.API_REMOTA_DESARROLLO = '';
  process.env.APP_ACCESS_CODE = 'codigo-de-prueba-local';
  let servidor;
  try {
    servidor = await createServer({ configFile: resolve('vite.config.js'), configLoader: 'runner', logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } });
    await servidor.listen();
    const { port } = servidor.httpServer.address();
    const base = `http://127.0.0.1:${port}`;
    const metodo = await fetch(`${base}/api/diagnostico-tscp`);
    assert.equal(metodo.status, 405);
    assert.match((await metodo.json()).error, /POST/);
    const protegida = await fetch(`${base}/api/diagnostico-tscp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(protegida.status, 401);
    assert.equal((await protegida.json()).codigoRequerido, true);
    const conexiones = await fetch(`${base}/api/estado-apis`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-codigo-acceso': 'codigo-de-prueba-local' }, body: '{}' });
    assert.equal(conexiones.status, 200);
    assert.ok(Array.isArray((await conexiones.json()).fuentes));
    const desconocida = await fetch(`${base}/api/no-existe`);
    assert.equal(desconocida.status, 404);
    assert.match(desconocida.headers.get('content-type'), /application\/json/);
    assert.match((await desconocida.json()).error, /ruta de API/);
  } finally {
    await servidor?.close();
    if (anterior.remoto === undefined) delete process.env.API_REMOTA_DESARROLLO; else process.env.API_REMOTA_DESARROLLO = anterior.remoto;
    if (anterior.codigo === undefined) delete process.env.APP_ACCESS_CODE; else process.env.APP_ACCESS_CODE = anterior.codigo;
  }
});
