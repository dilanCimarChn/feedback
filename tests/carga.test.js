import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCacheAsync, crearLimitador, ErrorServicio, responderErrorServicio } from '../api/_lib/carga.js';
import { consultarGemini } from '../api/_lib/comun.js';
import { investigarMarketing } from '../api/_lib/investigacion-marketing.js';

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

test('120 solicitudes: concurrencia acotada, cola limitada y rechazo recuperable', async () => {
  const limitar = crearLimitador({ concurrencia: 4, colaMaxima: 100, esperaMs: 1000 });
  let activos = 0, pico = 0;
  const resultados = await Promise.allSettled(Array.from({ length: 120 }, () => limitar(async () => {
    activos++; pico = Math.max(pico, activos);
    try { await esperar(2); return 'ok'; } finally { activos--; }
  })));
  assert.equal(pico, 4);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 104);
  const rechazados = resultados.filter(r => r.status === 'rejected');
  assert.equal(rechazados.length, 16);
  assert.ok(rechazados.every(r => r.reason instanceof ErrorServicio && r.reason.status === 503));
  assert.equal(await limitar(() => 'recuperado'), 'recuperado');
});

test('una espera vencida sale de la cola y los fallos liberan capacidad', async () => {
  const limitar = crearLimitador({ concurrencia: 1, colaMaxima: 2, esperaMs: 5 });
  const primera = limitar(() => esperar(20));
  await assert.rejects(limitar(() => 'no debe ejecutarse'), ErrorServicio);
  await primera;
  await assert.rejects(limitar(() => { throw new Error('Fallo'); }));
  assert.equal(await limitar(() => 1), 1);
});

test('120 lectores de una misma fuente comparten el trabajo y respetan TTL y fallos', async () => {
  let reloj = 0, llamadas = 0;
  const cache = crearCacheAsync({ max: 2, pendientesMax: 2, ttlMs: 10, ahora: () => reloj });
  const cargar = async () => { llamadas++; await esperar(2); return { dato: llamadas }; };
  const valores = await Promise.all(Array.from({ length: 120 }, () => cache('fuente', cargar)));
  assert.equal(llamadas, 1);
  assert.ok(valores.every(v => v === valores[0]));
  await cache('fuente', cargar); assert.equal(llamadas, 1);
  reloj = 11;
  await cache('fuente', cargar); assert.equal(llamadas, 2);
  await assert.rejects(cache('fallo', () => { throw new Error('Proveedor caído'); }));
  assert.equal(await cache('fallo', () => 'recuperado'), 'recuperado');
  await cache('otra', () => 'otra');
  await cache('fuente', cargar); assert.equal(llamadas, 3);
});

test('la cache limita claves simultáneas sin bloquear lectores de una clave existente', async () => {
  const cache = crearCacheAsync({ pendientesMax: 1 });
  const primera = cache('a', () => esperar(10));
  await assert.rejects(cache('b', () => 'b'), ErrorServicio);
  await cache('a', () => { throw new Error('No duplicar'); });
  await primera;
  assert.equal(await cache('b', () => 'b'), 'b');
});

test('120 investigaciones iguales consultan cada proveedor una sola vez', async () => {
  const original=globalThis.fetch;
  const claves=Object.keys(process.env).filter(k=>/^(YOUTUBE_|META_|FACEBOOK_|INSTAGRAM_|TIKTOK_|X_BEARER_|LINKEDIN_)/.test(k));
  const previas=Object.fromEntries(claves.map(k=>[k,process.env[k]]));
  let rss=0,noticias=0;
  try {
    claves.forEach(k=>delete process.env[k]);
    globalThis.fetch=async url=>{
      await esperar(3);
      if(String(url).includes('trends.google.com')) { rss++; return {ok:true,text:async()=>'<rss><channel><item><title>Educación</title></item></channel></rss>'}; }
      noticias++; return {ok:true,json:async()=>({articles:[]})};
    };
    const resultados=await Promise.all(Array.from({length:120},()=>investigarMarketing('PE','educación carga 120')));
    assert.equal(rss,1); assert.equal(noticias,1);
    assert.ok(resultados.every(r=>r===resultados[0]));
    await investigarMarketing('PE','otro tema carga 120');
    assert.equal(rss,1,'El RSS por país también se comparte entre temas distintos');
    assert.equal(noticias,2);
  } finally { globalThis.fetch=original;Object.entries(previas).forEach(([k,v])=>{process.env[k]=v;}); }
});

test('Gemini atiende 120 solicitudes con un máximo de 8 llamadas externas activas', async () => {
  const original = globalThis.fetch;
  let activos = 0, pico = 0, llamadas = 0;
  try {
    globalThis.fetch = async (url, opciones) => {
      assert.ok(opciones.signal instanceof AbortSignal);
      activos++; llamadas++; pico = Math.max(pico, activos);
      await esperar(3); activos--;
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) };
    };
    const resultados = await Promise.allSettled(Array.from({ length: 120 }, () => consultarGemini('carga-test', [{ text: 'plan' }])));
    assert.equal(pico, 8); assert.equal(llamadas, 108);
    assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 108);
    assert.equal(resultados.filter(r => r.status === 'rejected' && r.reason.status === 503).length, 12);
  } finally { globalThis.fetch = original; }
});

test('429 no dispara fallback, comparte pausa por clave y devuelve Retry-After', async () => {
  const original = globalThis.fetch;
  let llamadas = 0;
  try {
    globalThis.fetch = async () => { llamadas++; return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '15' }) }; };
    let error;
    try { await consultarGemini('cuota-test', [{ text: 'plan' }]); } catch (e) { error = e; }
    assert.equal(error.status, 429);
    await assert.rejects(consultarGemini('cuota-test', []), e => e.status === 429);
    assert.equal(llamadas, 1);
    const res = { setHeader(k,v) { this[k]=v; }, status(c) { this.code=c; return this; }, json(d) { this.data=d; } };
    assert.ok(responderErrorServicio(res, error));
    assert.equal(res.code, 429); assert.equal(res['Retry-After'], '15');
  } finally { globalThis.fetch = original; }
});

test('Gemini usa una sola alternativa ante saturación y mantiene el límite total sin cambiar una cuota por más peticiones', async () => {
  const previo=globalThis.fetch;let modelos=[];
  try {
    globalThis.fetch=async url=>{modelos.push(String(url));return modelos.length===1?{ok:false,status:503}:{ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]})};};
    assert.equal((await consultarGemini('alternativa-saturacion',[])).ok,true);assert.equal(modelos.length,2);assert.notEqual(modelos[0],modelos[1]);
    modelos=[];globalThis.fetch=async url=>{modelos.push(String(url));return {ok:false,status:503};};
    await assert.rejects(consultarGemini('todos-saturados',[]),e=>e.status===503);assert.equal(modelos.length,2);
  }finally{globalThis.fetch=previo;}
});

test('Gemini no reintenta rechazos permanentes ni timeouts como si fueran modelos ausentes', async () => {
  const original = globalThis.fetch;
  try {
    let llamadas=0;
    globalThis.fetch=async()=>{llamadas++;return {ok:false,status:403};};
    await assert.rejects(consultarGemini('permisos-test',[]), e=>e.status===502);
    assert.equal(llamadas,1);
    globalThis.fetch=async()=>{throw new DOMException('Tiempo agotado','TimeoutError');};
    await assert.rejects(consultarGemini('timeout-test',[]), e=>e.status===504);
  } finally { globalThis.fetch=original; }
});

test('los calendarios pueden ampliar la espera sin superar el presupuesto total de IA', async () => {
  const originalFetch=globalThis.fetch, originalTimeout=AbortSignal.timeout;
  const limites=[];
  try {
    AbortSignal.timeout=ms=>{limites.push(ms);return originalTimeout(ms);};
    globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{}'}]}}]})});
    await consultarGemini('espera-calendario',[{text:'Calendario'}]);
    await consultarGemini('espera-calendario',[{text:'Calendario'}],{tiempoRespuestaMs:32000});
    await consultarGemini('espera-calendario',[{text:'Calendario'}],{tiempoRespuestaMs:90000});
    assert.equal(limites[0],18000);
    assert.ok(limites[1]>18000 && limites[1]<=32000);
    assert.ok(limites[2]>18000 && limites[2]<=32000);
  } finally {globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;}
});

test('los archivos excesivos se rechazan antes de llamar a Gemini y no retienen capacidad', async () => {
  const original=globalThis.fetch;
  let llamadas=0;
  try {
    globalThis.fetch=async()=>{llamadas++;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{}'}]}}]})};};
    await assert.rejects(consultarGemini('archivos-test',[{inlineData:{data:'x'.repeat(17*1024*1024)}}]),e=>e.status===503);
    assert.equal(llamadas,0);
    assert.deepEqual(await consultarGemini('archivos-test',[{text:'Una solicitud pequeña'}]),{});
    assert.equal(llamadas,1);
  } finally {globalThis.fetch=original;}
});
