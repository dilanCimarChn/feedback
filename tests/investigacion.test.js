import test from 'node:test';
import assert from 'node:assert/strict';
import { consultaGeografica, hashtagsObservados, investigarMarketing } from '../api/_lib/investigacion-marketing.js';
import { catalogarFuentes } from '../api/_lib/precision-marketing.js';

test('la búsqueda combina tema con menciones de país y localidad sin aceptar operadores', () => {
  const query = consultaGeografica('US', 'nonprofit education', 'New York');
  assert.match(query, /^\(education OR school OR learning OR scholarship\) "United States" "New York"$/);
  const espanol=consultaGeografica('US','ONG de educación en EEUU captar donantes','New York');
  assert.equal(espanol,query,'El sector se busca en inglés y mantiene la localidad');
  const sinOperadores = consultaGeografica('BO', 'education OR sourcecountry:XX', 'La Paz" OR "anywhere');
  assert.ok(!sinOperadores.includes('sourcecountry:'));
  assert.match(sinOperadores,/"Bolivia" "La Paz anywhere"$/);
});

test('hashtags observados tienen red y enlace, conservan prioridad y no inventan volumen', () => {
  const item = {titulo:'Contenido',url:'https://example.org/post',fecha:'2026-11-15',hashtags:['#Comunidad','#parati','#Comunidad','no-valido']};
  const resultado = hashtagsObservados([
    {fuente:'TikTok',alcance:'Cuenta autorizada',items:[item]},
    {fuente:'Facebook',alcance:'Cuenta autorizada',items:[item,{...item,url:'javascript:alert(1)',hashtags:['#Otro']}]},
  ], [{...item,pertinente:false,hashtags:['#NoPertinente']}], '2026-11-16T12:00:00Z');
  assert.deepEqual(resultado.map(h=>h.red), ['Facebook','Facebook','TikTok','TikTok']);
  assert.equal(resultado[0].hashtag, '#Comunidad');
  assert.equal(resultado[0].consultado, '2026-11-16T12:00:00Z');
  assert.ok(resultado.every(h=>h.url==='https://example.org/post' && /sin volumen/.test(h.base)));
  assert.ok(!resultado.some(h=>'volumen' in h));
});

test('el catálogo excluye señales ajenas al tema y conserva hashtags y alcance de cuentas', () => {
  const catalogo=catalogarFuentes({pais:'US',consultado:'2026-11-16',tendencias:[{tema:'Evento deportivo',url:'https://example.org/deporte',pertinente:false},{tema:'Education',url:'https://example.org/education',pertinente:true}],videos:[{titulo:'Canción',pertinente:false}],plataformas:[{fuente:'Facebook',alcance:'Cuenta autorizada',items:[{titulo:'Comunidad #Education',url:'https://example.org/fb',hashtags:['#Education']}]}]});
  assert.equal(catalogo.length,2);
  assert.equal(catalogo[0].titulo,'Education');
  assert.deepEqual(catalogo[1].observaciones.hashtagsObservados,['#Education']);
  assert.equal(catalogo[1].observaciones.alcance,'Cuenta autorizada');
});

test('investigación amplía localidad sin resultados al país y separa cachés por localidad', async () => {
  const originalFetch=globalThis.fetch;
  const claves=Object.keys(process.env).filter(k=>/^(YOUTUBE_|META_|FACEBOOK_|INSTAGRAM_|TIKTOK_|X_BEARER_|LINKEDIN_)/.test(k));
  const previas=Object.fromEntries(claves.map(k=>[k,process.env[k]]));
  const queries=[];
  try {
    claves.forEach(k=>delete process.env[k]);
    globalThis.fetch=async url=>{
      const u=new URL(url);
      if (u.hostname==='trends.google.com') return {ok:true,text:async()=>'<rss><channel><item><title>Education program</title></item><item><title>Football championship</title></item></channel></rss>'};
      const query=u.searchParams.get('query');queries.push(query);
      return {ok:true,json:async()=>({articles:query.includes('New York')||query.includes('Boston')?[]:[{title:'Education program in US',url:'https://example.org/news',seendate:'20261115T000000Z'}]})};
    };
    const primero=await investigarMarketing('US','ONG de educación en EEUU captar donantes geographic test','New York');
    assert.equal(queries.length,2);
    assert.ok(queries.every(q=>q.includes('"United States"')));
    assert.match(primero.alcanceGeografico.noticias,/sin resultados para la localidad/);
    assert.equal(primero.alcanceGeografico.regionSolicitada,'New York');
    assert.equal(primero.noticias.length,1);
    assert.deepEqual(primero.prioridadRedes,['Facebook','Instagram','TikTok','X','LinkedIn','YouTube']);
    assert.equal(primero.tendencias[0].pertinente,true);
    assert.equal(primero.tendencias[1].pertinente,false);
    await investigarMarketing('US','ONG de educación en EEUU captar donantes geographic test','New York');
    assert.equal(queries.length,2,'Misma localidad comparte consulta');
    const segundo=await investigarMarketing('US','ONG de educación en EEUU captar donantes geographic test','Boston');
    assert.equal(queries.length,4,'Cambiar localidad no reutiliza noticias de otra ciudad');
    assert.equal(segundo.alcanceGeografico.regionSolicitada,'Boston');
    assert.equal(segundo.estados.find(s=>s.fuente==='Facebook').estado,'Sin configurar');
  } finally {
    globalThis.fetch=originalFetch;
    Object.entries(previas).forEach(([k,v])=>{process.env[k]=v;});
  }
});
