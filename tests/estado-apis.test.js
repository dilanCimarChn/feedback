import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoApis } from '../api/_lib/estado-apis.js';
import handler from '../api/estado-apis.js';

test('estado de APIs muestra faltantes y distingue adaptadores excluidos sin devolver valores', () => {
  const env = { GEMINI_API_KEY: 'secreto-123', INSTAGRAM_ACCESS_TOKEN: 'token-no-exponer', INSTAGRAM_USER_ID: '112233', META_GRAPH_VERSION: 'v99.0', VERCEL_ENV: 'production', X_BEARER_TOKEN: 'no-activar' };
  const estado = estadoApis(env, new Date('2026-11-25T12:00:00Z'));
  const fuente = id => estado.fuentes.find(f => f.id === id);
  assert.equal(estado.entorno, 'produccion');
  assert.equal(fuente('gemini').configurada, true);
  assert.equal(fuente('instagram-hashtag').configurada, true);
  assert.deepEqual(fuente('instagram-business-discovery').faltantes, []);
  assert.deepEqual(fuente('youtube').faltantes, ['YOUTUBE_API_KEY']);
  assert.equal(fuente('google-trends').configurada, true);
  assert.equal(fuente('x').estado, 'Excluida');
  assert.equal(fuente('x').configurada, false);
  assert.equal(fuente('tiktok-discovery').estado, 'Falta configuración');
  assert.match(fuente('tiktok-discovery').alcance, /términos de búsqueda/);
  for (const valor of ['secreto-123', 'token-no-exponer', '112233', 'v99.0', 'no-activar']) assert.ok(!JSON.stringify(estado).includes(valor));
  assert.ok(estado.fuentes.every(f => f.documentacion.startsWith('https://')));
});

test('la consulta de configuración no exige Gemini y conserva la autenticación del proyecto', () => {
  const anterior = process.env.APP_ACCESS_CODE;
  const invocar = (headers = {}, method = 'POST', body = { accion: 'estado' }) => {
    const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, setHeader(k, v) { this[k] = v; } };
    handler({ method, headers, body }, res); return res;
  };
  try {
    process.env.APP_ACCESS_CODE = 'codigo-protegido';
    assert.equal(invocar().code, 401);
    assert.equal(invocar().data.codigoRequerido, true);
    assert.equal(invocar({}, 'GET').code, 405);
    const res = invocar({ 'x-codigo-acceso': 'codigo-protegido' });
    assert.equal(res.code, 200);
    assert.equal(res['Cache-Control'], 'private, no-store');
    assert.equal(invocar({ 'x-codigo-acceso': 'codigo-protegido' }, 'POST', { accion: 'guardar' }).code, 400);
    delete process.env.APP_ACCESS_CODE;
    assert.equal(invocar().code, 200);
  } finally { if (anterior === undefined) delete process.env.APP_ACCESS_CODE; else process.env.APP_ACCESS_CODE = anterior; }
});
