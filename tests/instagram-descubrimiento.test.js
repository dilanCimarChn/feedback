import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarInstagramExterno } from '../api/_lib/instagram-descubrimiento.js';

const variables = ['META_GRAPH_VERSION', 'INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN'];
const respuesta = (datos, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => datos });
const media = (codigo, extras = {}) => ({ id: '9876', caption: 'Education #Education #Learning', media_type: 'VIDEO',
  permalink: `https://www.instagram.com/p/${codigo}/`, timestamp: '2026-11-17T12:00:00Z', comments_count: 2, ...extras });

async function entorno(id, ejecutar) {
  const anterior = Object.fromEntries(variables.map(k => [k, process.env[k]]));
  const fetchAnterior = globalThis.fetch;
  try {
    Object.assign(process.env, { META_GRAPH_VERSION: 'v99.0', INSTAGRAM_USER_ID: id, INSTAGRAM_ACCESS_TOKEN: 'token-prueba-instagram-externo' });
    await ejecutar();
  } finally {
    globalThis.fetch = fetchAnterior;
    for (const [clave, valor] of Object.entries(anterior)) if (valor === undefined) delete process.env[clave]; else process.env[clave] = valor;
  }
}

test('Instagram externo declara accesos faltantes y rechaza configuración inválida sin solicitudes', async () => {
  await entorno('6101', async () => {
    let llamadas = 0;
    globalThis.fetch = async () => { llamadas++; throw new Error('No debe consultar'); };
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    const falta = await consultarInstagramExterno({ tema: 'education', pais: 'US' });
    assert.equal(falta.estado, 'Sin configurar');
    assert.equal(falta.modo, 'descubrimiento_externo');
    assert.match(falta.detalle, /INSTAGRAM_ACCESS_TOKEN/);
    assert.match(falta.detalle, /App Review/);
    process.env.INSTAGRAM_ACCESS_TOKEN = 'token-prueba';
    process.env.META_GRAPH_VERSION = 'https://evil.example/';
    assert.equal((await consultarInstagramExterno({ tema: 'education' })).estado, 'No disponible');
    process.env.META_GRAPH_VERSION = 'v99.0';
    process.env.INSTAGRAM_USER_ID = '../media';
    assert.equal((await consultarInstagramExterno({ tema: 'education' })).estado, 'No disponible');
    assert.equal(llamadas, 0);
  });
});

test('consulta un hashtag temático, conserva fuentes externas y no inventa métricas o ubicación', async () => {
  await entorno('6102', async () => {
    const peticiones = [];
    globalThis.fetch = async (url, opciones) => {
      const u = new URL(url); peticiones.push({ u, opciones });
      if (u.pathname.endsWith('/ig_hashtag_search')) {
        assert.equal(u.searchParams.get('q'), 'education');
        assert.equal(u.searchParams.get('user_id'), '6102');
        return respuesta({ data: [{ id: '9102' }] });
      }
      assert.equal(u.pathname, '/v99.0/9102/top_media');
      const campos = u.searchParams.get('fields').split(',');
      assert.deepEqual(campos, ['id', 'permalink', 'caption']);
      assert.ok(!campos.includes('username') && !campos.includes('media_product_type'));
      assert.equal(u.searchParams.get('limit'), '3');
      return respuesta({ data: [media('EDU_1', { permalink: 'https://www.instagram.com/p/EDU_1/?tracking=1#hash' }),
        media('NO', { permalink: 'https://evil.example/p/NO/', like_count: 99 }),
        media('NO', { permalink: 'javascript:alert(1)' })] });
    };
    const resultado = await consultarInstagramExterno({ tema: 'ONG de educación para donantes', pais: 'US', region: 'New York' });
    assert.equal(resultado.estado, 'Consultada');
    assert.equal(resultado.items.length, 1);
    assert.equal(resultado.items[0].url, 'https://www.instagram.com/p/EDU_1/');
    assert.equal(resultado.items[0].etiqueta, 'Publicaciones destacadas por hashtag en Instagram');
    assert.equal(resultado.items[0].formato, 'Clip', 'VIDEO no prueba que sea Reel');
    assert.equal(resultado.items[0].metricas.likes, null);
    assert.equal(resultado.items[0].metricas.comentarios, 2);
    assert.deepEqual(resultado.items[0].hashtags, ['#Education', '#Learning']);
    assert.equal(resultado.items[0].tipoFuente, 'InstagramHashtag');
    assert.equal(resultado.items[0].procedencias.length, 1);
    assert.equal(resultado.items[0].fecha, '2026-11-17T12:00:00.000Z');
    assert.equal(resultado.contextoGeografico.aplicado, false);
    assert.equal(resultado.contextoGeografico.regionSolicitada, 'New York');
    assert.equal(resultado.subfuentes.length, 1);
    assert.equal(resultado.subfuentes[0].seleccion, 'top_media');
    assert.equal(peticiones.length, 2);
    assert.ok(peticiones.every(p => p.u.hostname === 'graph.facebook.com' && p.u.protocol === 'https:'));
    assert.ok(peticiones.every(p => !p.u.searchParams.has('access_token') && p.opciones.redirect === 'error'));
    assert.ok(peticiones.every(p => p.opciones.headers.Authorization === 'Bearer token-prueba-instagram-externo'));
    assert.ok(!JSON.stringify(resultado).includes('token-prueba-instagram-externo'));
    const consultas = peticiones.length;
    await consultarInstagramExterno({ tema: 'educación', pais: 'US', region: 'California' });
    assert.equal(peticiones.length, consultas, 'El país y la ciudad no fabrican un filtro geográfico ni invalidan los mismos medios');
  });
});

test('Business Discovery solo consulta cuentas indicadas, con nombres seguros y sin media propia', async () => {
  await entorno('6103', async () => {
    const consultas = [];
    globalThis.fetch = async url => {
      const u = new URL(url); consultas.push(u);
      assert.equal(u.pathname, '/v99.0/6103');
      assert.match(u.searchParams.get('fields'), /^business_discovery\.username\(referencia_educativa\)\{id,username,media\.limit\(10\)\{/);
      return respuesta({ business_discovery: { id: '7103', media: { data: [media('REFERENCIA', { media_type: 'CAROUSEL_ALBUM', like_count: '20', timestamp: 1794916800 })] } } });
    };
    const resultado = await consultarInstagramExterno({ cuentas: ['@referencia_educativa', 'https://evil.example/', 'name){media}'], pais: 'BO' });
    assert.equal(resultado.estado, 'Consultada');
    assert.equal(resultado.items[0].tipoFuente, 'InstagramBusinessDiscovery');
    assert.equal(resultado.items[0].formato, 'Carrusel');
    assert.equal(resultado.items[0].metricas.likes, 20);
    assert.deepEqual(resultado.cuentasReferencia, ['@referencia_educativa']);
    assert.equal(consultas.length, 1);
    assert.ok(resultado.avisos.some(a => /nombre inválido/.test(a)));
    const invalidas = await consultarInstagramExterno({ cuentas: ['https://evil.example/?fields=media'] });
    assert.equal(invalidas.estado, 'No disponible');
    assert.equal(consultas.length, 1);
  });
});

test('errores de acceso público no se ocultan y las otras rutas pueden aportar resultados', async () => {
  await entorno('6104', async () => {
    const consultadas = [];
    globalThis.fetch = async url => {
      const u = new URL(url); consultadas.push(u.pathname);
      if (u.pathname.endsWith('/ig_hashtag_search')) return respuesta({ error: { code: 10, message: 'NO MOSTRAR token-prueba-instagram-externo' } }, 403);
      return respuesta({ business_discovery: { id: '7104', media: { data: [media('PARCIAL')] } } });
    };
    const resultado = await consultarInstagramExterno({ hashtags: ['educacion'], cuentas: ['organizacion'] });
    assert.equal(resultado.estado, 'Consultada');
    assert.equal(resultado.parcial, true);
    assert.equal(resultado.items[0].tipoFuente, 'InstagramBusinessDiscovery');
    assert.ok(resultado.avisos.some(a => /App Review/.test(a) && /Instagram Public Content Access/.test(a)));
    assert.ok(consultadas.every(p => !p.endsWith('/media')));
    assert.ok(!JSON.stringify(resultado).includes('NO MOSTRAR'));
    assert.ok(!JSON.stringify(resultado).includes('token-prueba-instagram-externo'));
  });
  await entorno('6105', async () => {
    globalThis.fetch = async url => new URL(url).pathname.endsWith('/ig_hashtag_search')
      ? respuesta({ data: [{ id: '9105' }] })
      : new URL(url).pathname.endsWith('/top_media') ? respuesta({}, 404)
        : respuesta({ data: [media('RECENT')] });
    const resultado = await consultarInstagramExterno({ hashtags: ['educacion'] });
    assert.equal(resultado.estado, 'No disponible');
    assert.equal(resultado.parcial, false);
    assert.equal(resultado.items.length, 0);
    assert.equal(resultado.subfuentes[0].seleccion, 'top_media');
    assert.equal(resultado.subfuentes[0].causa, 'error_proveedor');
  });
});

test('las consultas no accesibles y una referencia propia no se presentan como descubrimiento externo', async () => {
  await entorno('6106', async () => {
    globalThis.fetch = async () => respuesta({ error: { code: 200 } }, 403);
    const denegada = await consultarInstagramExterno({ cuentas: ['referencia'] });
    assert.equal(denegada.estado, 'No disponible');
    assert.deepEqual(denegada.items, []);
    assert.ok(denegada.avisos.some(a => /instagram_manage_insights/.test(a)));
    globalThis.fetch = async () => respuesta({ business_discovery: { id: '6106', media: { data: [media('PROPIA')] } } });
    const propia = await consultarInstagramExterno({ cuentas: ['mi_cuenta'] });
    assert.equal(propia.estado, 'No disponible');
    assert.deepEqual(propia.items, []);
    assert.ok(propia.avisos.some(a => /coincide con la cuenta autorizada/.test(a)));
  });
});

test('respeta dos hashtags y dos cuentas como máximo sin aceptar rutas o campos inyectados', async () => {
  await entorno('6107', async () => {
    const peticiones = [];
    globalThis.fetch = async url => {
      const u = new URL(url); peticiones.push(u);
      if (u.pathname.endsWith('/ig_hashtag_search')) return respuesta({ data: [{ id: '9107' }] });
      if (u.pathname === '/v99.0/6107') return respuesta({ business_discovery: { id: '7107', media: { data: [] } } });
      return respuesta({ data: [] });
    };
    const resultado = await consultarInstagramExterno({ hashtags: ['#Uno', 'dos', 'tres', '../media'], cuentas: ['primera', 'segunda', 'tercera'] });
    assert.deepEqual(resultado.hashtagsConsultados, ['#uno', '#dos']);
    assert.deepEqual(resultado.cuentasReferencia, ['@primera', '@segunda']);
    assert.equal(resultado.estado, 'Sin resultados');
    assert.equal(peticiones.length, 6);
    assert.ok(resultado.avisos.some(a => /máximo 2/.test(a)));
    assert.ok(peticiones.every(u => u.hostname === 'graph.facebook.com'));
  });
});

test('la caché reutiliza IDs durante siete días y el límite de 30 etiquetas es local y por cuenta', async () => {
  await entorno('6108', async () => {
    const ahoraOriginal = Date.now;
    let ahora = ahoraOriginal(), busquedas = 0, medios = 0;
    Date.now = () => ahora;
    try {
      globalThis.fetch = async url => {
        const u = new URL(url);
        if (u.pathname.endsWith('/ig_hashtag_search')) { busquedas++; return respuesta({ data: [{ id: '9108' }] }); }
        medios++; return respuesta({ data: [media('CUOTA')] });
      };
      await Promise.all([consultarInstagramExterno({ hashtags: ['etiqueta0'] }), consultarInstagramExterno({ hashtags: ['etiqueta0'] })]);
      assert.equal(busquedas, 1); assert.equal(medios, 1);
      await consultarInstagramExterno({ hashtags: ['etiqueta0'] });
      assert.equal(busquedas, 1); assert.equal(medios, 1);
      ahora += 16 * 60000;
      await consultarInstagramExterno({ hashtags: ['etiqueta0'] });
      assert.equal(busquedas, 1, 'El ID se conserva al renovar los medios de 15 minutos');
      assert.equal(medios, 2);
      for (let i = 1; i < 30; i++) await consultarInstagramExterno({ hashtags: [`etiqueta${i}`] });
      assert.equal(busquedas, 30);
      const antes = busquedas + medios;
      const limite = await consultarInstagramExterno({ hashtags: ['etiqueta30'] });
      assert.equal(limite.estado, 'No disponible');
      assert.equal(limite.cuota.registradosLocalmente, 30);
      assert.match(limite.cuota.alcance, /reinicios o instancias/);
      assert.ok(limite.avisos.some(a => /Límite local/.test(a)));
      assert.equal(busquedas + medios, antes);
      process.env.INSTAGRAM_ACCESS_TOKEN = 'token-renovado';
      assert.equal((await consultarInstagramExterno({ hashtags: ['otra-etiqueta-invalida', 'etiqueta31'] })).estado, 'No disponible');
      assert.equal(busquedas + medios, antes, 'Cambiar token no reinicia la cuota local de la cuenta');
      ahora += 7 * 86400000;
      const renovada = await consultarInstagramExterno({ hashtags: ['etiqueta30'] });
      assert.equal(renovada.estado, 'Consultada');
      assert.equal(renovada.cuota.registradosLocalmente, 1);
      assert.equal(busquedas, 31);
    } finally { Date.now = ahoraOriginal; }
  });
});
