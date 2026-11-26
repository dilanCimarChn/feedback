import test from 'node:test';
import assert from 'node:assert/strict';
import { recopilarApoyoTscp } from '../api/_lib/referencias-automaticas.js';

const ahora = new Date('2026-11-25T12:00:00Z');
const configuracion = { pais: 'US', objetivoTipo: 'voluntario', objetivo: 'Captar personas voluntarias para TSCP.', mision: 'Coordinar recursos para logística humanitaria.', vocabulario: ['Colaboración'] };
const entrada = { configuracion, perfil: { nombre: 'TSCP' }, referentes: [{ canal: 'Instagram', cuenta: 'good360' }] };
const rss = temas => '<rss><channel>' + temas.map((tema, i) => `<item><title>${tema}</title><link>https://trends.google.com/trending?geo=US</link><pubDate>Wed, 25 Nov 2026 09:00:00 GMT</pubDate><ht:approx_traffic>${i + 1}K</ht:approx_traffic></item>`).join('') + '</channel></rss>';
const respuestaRss = temas => async url => { assert.equal(new URL(url).hostname, 'trends.google.com'); return { ok: true, text: async () => rss(temas) }; };
const prohibido = async () => { throw new Error('No debería consultar una fuente sin configuración.'); };

test('consulta las fuentes existentes y conserva origen y límites sin simular métricas de competidores', async () => {
  const env = { YOUTUBE_API_KEY: 'youtube-no-exponer', META_GRAPH_VERSION: 'v99.0', INSTAGRAM_USER_ID: '123', INSTAGRAM_ACCESS_TOKEN: 'instagram-no-exponer', FACEBOOK_PUBLIC_ACCESS_TOKEN: 'facebook-no-exponer', FACEBOOK_DISCOVERY_PAGE_IDS: '456' };
  const resultado = await recopilarApoyoTscp(entrada, { env, ahora, fetchImpl: respuestaRss(['Humanitarian logistics', 'Resultado de fútbol']),
    youtube: async (pais, consulta, opciones) => {
      assert.equal(pais, 'US'); assert.match(consulta, /nonprofit.*volunteer recruitment/); assert.equal(opciones.sinFiltroFecha, true);
      return { conectado: true, videos: [{ titulo: 'Nonprofit logistics volunteering', url: 'https://www.youtube.com/watch?v=12345678901&key=no-conservar', publicado: '2026-11-20', vistas: 900 }, { titulo: 'Música popular', url: 'https://www.youtube.com/watch?v=12345678902' }], alcance: 'Búsqueda pública, no ranking.' };
    },
    instagram: async opciones => { assert.deepEqual(opciones.cuentas, ['good360']); return { estado: 'Consultada', items: [{ titulo: 'Volunteer logistics in action', url: 'https://www.instagram.com/p/ejemplo/', fecha: '2026-11-21', hashtags: ['#Voluntariado'] }] }; },
    facebook: async () => ({ estado: 'Consultada', items: [{ titulo: 'Humanitarian resource coordination', url: 'https://www.facebook.com/posts/123', fecha: '2026-11-22' }] }),
  });
  assert.equal(resultado.fuentes.length, 4);
  assert.deepEqual(resultado.fuentes.map(f => f.canalOrigen), ['YouTube', 'Instagram', 'Facebook', 'Google Trends']);
  assert.ok(resultado.fuentes.every(f => f.referenteId === null && f.id.startsWith('apoyo:')));
  assert.equal(resultado.fuentes.find(f => f.canalOrigen === 'YouTube').canal, null);
  assert.equal(resultado.fuentes.find(f => f.canalOrigen === 'Instagram').canal, 'Instagram');
  assert.equal(resultado.fuentes.find(f => f.canalOrigen === 'Facebook').canal, 'Facebook');
  assert.ok(resultado.fuentes.every(f => f.texto && f.alcance && f.consultado === ahora.toISOString()));
  assert.ok(!resultado.fuentes.some(f => 'seguidores' in f || 'vistas' in f));
  assert.match(resultado.limite, /No completan perfiles/);
  for (const secreto of Object.values(env)) if (secreto.includes('no-exponer')) assert.ok(!JSON.stringify(resultado).includes(secreto));
  assert.ok(!JSON.stringify(resultado).includes('no-conservar'));
});

test('la caída de YouTube no descarta coincidencias de Trends ni refleja errores del proveedor', async () => {
  const resultado = await recopilarApoyoTscp(entrada, { env: { YOUTUBE_API_KEY: 'secreto-de-cuota' }, ahora, fetchImpl: respuestaRss(['Voluntariado humanitario']), youtube: async () => { throw new Error('Secreto secreto-de-cuota'); }, instagram: prohibido, facebook: prohibido });
  assert.equal(resultado.fuentes.length, 1);
  assert.equal(resultado.fuentes[0].canalOrigen, 'Google Trends');
  assert.equal(resultado.estados.find(e => e.fuente === 'YouTube').estado, 'No disponible');
  assert.ok(!JSON.stringify(resultado).includes('secreto-de-cuota'));
});

test('los temas ajenos de Trends no se usan como inspiración y no se consulta YouTube sin clave', async () => {
  let llamadas = 0;
  const resultado = await recopilarApoyoTscp(entrada, { env: {}, ahora, fetchImpl: respuestaRss(['Resultado deportivo', 'Artista del momento']), youtube: async () => { llamadas++; return {}; }, instagram: prohibido, facebook: prohibido });
  assert.equal(llamadas, 0);
  assert.deepEqual(resultado.fuentes, []);
  assert.equal(resultado.estados.find(e => e.fuente === 'Google Trends').estado, 'Consultada · sin coincidencias');
  assert.equal(resultado.estados.find(e => e.fuente === 'YouTube').estado, 'Sin configurar');
});

test('consultas equivalentes comparten la búsqueda y renovar accesos activa la consulta externa', async () => {
  let consultasYouTube = 0, consultasRss = 0, consultasIg = 0;
  const youtube = async () => { consultasYouTube++; return { conectado: true, videos: [{ titulo: 'Nonprofit volunteering', url: 'https://www.youtube.com/watch?v=12345678901' }] }; };
  const instagram = async () => { consultasIg++; return { estado: 'Consultada', items: [{ titulo: 'Voluntariado logístico', url: 'https://www.instagram.com/p/prueba/' }] }; };
  const fetchImpl = async () => { consultasRss++; return { ok: true, text: async () => rss([]) }; };
  const opciones = { env: { YOUTUBE_API_KEY: 'clave-en-cache' }, ahora, youtube, instagram, facebook: prohibido, fetchImpl };
  const [a, b] = await Promise.all([recopilarApoyoTscp(entrada, opciones), recopilarApoyoTscp(entrada, opciones)]);
  assert.deepEqual(a, b); assert.equal(consultasYouTube, 1); assert.equal(consultasRss, 1); assert.equal(consultasIg, 0);
  await recopilarApoyoTscp(entrada, { ...opciones, env: { ...opciones.env, META_GRAPH_VERSION: 'v99.0', INSTAGRAM_USER_ID: '123', INSTAGRAM_ACCESS_TOKEN: 'nuevo-token' } });
  assert.equal(consultasIg, 1);
});

test('excluye URLs inseguras y texto no recibido, y limita a ocho referencias pertinentes', async () => {
  const resultado = await recopilarApoyoTscp(entrada, { env: { YOUTUBE_API_KEY: 'validacion', META_GRAPH_VERSION: 'v99.0', INSTAGRAM_USER_ID: '123', INSTAGRAM_ACCESS_TOKEN: 'prueba', FACEBOOK_PUBLIC_ACCESS_TOKEN: 'prueba-fb', FACEBOOK_DISCOVERY_PAGE_IDS: '456' }, ahora,
    fetchImpl: respuestaRss(['Nonprofit logistics']),
    youtube: async () => ({ conectado: true, videos: [{ titulo: 'Nonprofit inseguro', url: 'https://www.youtube.com.evil.test/watch?v=12345678901' }, { titulo: 'Nonprofit inseguro', url: 'https://secreto:clave@www.youtube.com/watch?v=12345678901' }, ...Array.from({ length: 10 }, (_, i) => ({ titulo: `Nonprofit logistics ${i}`, url: `https://www.youtube.com/watch?v=1234567890${i}` }))] }),
    instagram: async () => ({ estado: 'Consultada', items: [{ titulo: 'Voluntariado sin texto', url: 'https://www.instagram.com/p/sintexto/', textoDisponible: false }, ...[1, 2].map(i => ({ titulo: `Voluntariado ${i}`, url: `https://www.instagram.com/p/prueba${i}/` }))] }),
    facebook: async () => ({ estado: 'Consultada', items: [1, 2].map(i => ({ titulo: `Humanitarian logistics ${i}`, url: `https://www.facebook.com/posts/${i}` })) }),
  });
  assert.equal(resultado.fuentes.length, 8);
  assert.ok(resultado.fuentes.every(f => !f.url.includes('evil.test') && !f.url.includes('secreto') && !f.url.includes('sintexto')));
});

test('una lista inválida del proveedor no descarta las otras fuentes', async () => {
  const resultado = await recopilarApoyoTscp(entrada, { env: { YOUTUBE_API_KEY: 'respuesta-invalida' }, ahora, fetchImpl: respuestaRss(['Nonprofit volunteers']), youtube: async () => ({ conectado: true, videos: {} }), instagram: prohibido, facebook: prohibido });
  assert.equal(resultado.fuentes.length, 1);
  assert.equal(resultado.estados.find(e => e.fuente === 'YouTube').estado, 'No disponible');
});

test('TikTok Discovery se activa con sus credenciales y aporta términos, sin simular publicaciones', async () => {
  let consultas = 0;
  const tiktok = async ({ pais, tema }) => {
    consultas++; assert.equal(pais, 'US'); assert.match(tema, /nonprofit/);
    return { estado: 'Consultada', alcance: 'Términos públicos sin métricas ni país verificado.', items: [{ titulo: 'nonprofit volunteering', url: 'https://business-api.tiktok.com/docs', urlExplorar: 'https://www.tiktok.com/search?q=nonprofit%20volunteering' }, { titulo: 'Celebrity topic', urlExplorar: 'https://www.tiktok.com/search?q=celebrity' }] };
  };
  const opciones = { env: {}, ahora, fetchImpl: respuestaRss([]), youtube: prohibido, instagram: prohibido, facebook: prohibido, tiktok };
  const sinConfigurar = await recopilarApoyoTscp(entrada, opciones);
  assert.equal(consultas, 0); assert.equal(sinConfigurar.estados.find(e => e.fuente === 'TikTok').estado, 'Sin configurar');
  const resultado = await recopilarApoyoTscp(entrada, { ...opciones, env: { TIKTOK_DISCOVERY_ACCESS_TOKEN: 'secreto-discovery', TIKTOK_DISCOVERY_BUSINESS_ID: 'id-discovery' } });
  assert.equal(consultas, 1); assert.equal(resultado.fuentes.length, 1);
  const f = resultado.fuentes[0];
  assert.equal(f.canal, 'TikTok'); assert.equal(f.canalOrigen, 'TikTok'); assert.equal(f.esTermino, true); assert.equal(f.formato, 'Término de búsqueda');
  assert.match(f.url, /^https:\/\/www.tiktok.com\/search\?q=/);
  assert.match(f.texto, /no contiene publicaciones, CTA ni métricas/);
  assert.ok(!JSON.stringify(resultado).includes('secreto-discovery'));
});
