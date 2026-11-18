import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerSenales } from '../api/_lib/senales-sociales.js';

const reciente = () => new Date(Date.now() - 86400000).toISOString();
const item = (id, cambios = {}) => ({id,snippet:{title:'Educación comunitaria',description:'Aprende #Educación #Comunidad #Educación',publishedAt:reciente()},statistics:{viewCount:'2500',likeCount:'85'},contentDetails:{duration:'PT1M12S'},...cambios});

async function conFetch(key, fetch, tarea) {
  const anteriorKey = process.env.YOUTUBE_API_KEY, anteriorFetch = globalThis.fetch;
  try {
    if (key === null) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = key;
    globalThis.fetch = fetch;
    await tarea();
  } finally {
    globalThis.fetch = anteriorFetch;
    if (anteriorKey === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = anteriorKey;
  }
}

test('YouTube sin clave no consulta, informa modo y no inventa datos', async () => {
  await conFetch(null, async()=>{throw new Error('No debe consultar');}, async()=>{
    const resultado = await obtenerSenales('US','educación');
    assert.equal(resultado.conectado,false);
    assert.equal(resultado.modo,'busqueda_tematica');
    assert.equal(resultado.consulta,'educación');
    assert.equal(resultado.region,'US');
    assert.equal(resultado.consultado,null);
    assert.deepEqual(resultado.videos,[]);
    await assert.rejects(obtenerSenales('invalido','educación'), /País no válido/);
    await assert.rejects(obtenerSenales('US',{tema:'educación'}), /Tema no válido/);
  });
});

test('búsqueda temática reciente enriquece IDs únicos y nunca expone la clave en URL ni resultado', async () => {
  const peticiones=[];
  const ids=['abcDEF123_-','ZYXwv987_-0'];
  const fecha = reciente();
  await conFetch('clave-youtube-busqueda-simulada', async(url,options)=>{
    const u = new URL(url); peticiones.push({u,options});
    assert.equal(u.origin,'https://www.googleapis.com');
    assert.equal(options.method,'GET');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(u.searchParams.has('key'),false);
    assert.equal(options.headers['X-Goog-Api-Key'],'clave-youtube-busqueda-simulada');
    if (u.pathname.endsWith('/search')) {
      assert.equal(u.searchParams.get('q'),'ONG educación');
      assert.equal(u.searchParams.get('type'),'video');
      assert.equal(u.searchParams.get('maxResults'),'10');
      assert.equal(u.searchParams.get('regionCode'),'US');
      assert.equal(u.searchParams.get('order'),'relevance');
      assert.equal(Date.parse(u.searchParams.get('publishedBefore'))-Date.parse(u.searchParams.get('publishedAfter')),7*86400000);
      return {ok:true,json:async()=>({regionCode:'US',items:[
        {id:{videoId:ids[0]},snippet:{title:'Encontrado',publishedAt:fecha}},
        {id:{videoId:ids[0]},snippet:{publishedAt:fecha}},
        {id:{videoId:ids[1]},snippet:{publishedAt:fecha}},
        {id:{videoId:'https://malicioso.example'},snippet:{publishedAt:fecha}},
        {id:{channelId:ids[1]},snippet:{publishedAt:fecha}},
        {id:{videoId:'OLDvideo_12'},snippet:{publishedAt:'2000-01-01T00:00:00Z'}},
        {id:{videoId:'FUTvideo_12'},snippet:{publishedAt:'2099-01-01T00:00:00Z'}},
      ]})};
    }
    assert.equal(u.pathname,'/youtube/v3/videos');
    assert.equal(u.searchParams.get('id'),ids.join(','));
    assert.equal(u.searchParams.get('chart'),null);
    assert.equal(u.searchParams.get('maxResults'),null);
    assert.equal(u.searchParams.get('part'),'snippet,statistics,contentDetails');
    return {ok:true,json:async()=>({items:[item(ids[1]),item(ids[0]),item('NOTwanted01')]})};
  }, async()=>{
    const resultado=await obtenerSenales('US','  ONG   educación  ');
    assert.equal(resultado.conectado,true);
    assert.equal(resultado.modo,'busqueda_tematica');
    assert.equal(resultado.videos.length,2);
    assert.deepEqual(resultado.videos.map(v=>v.url),ids.map(id=>`https://www.youtube.com/watch?v=${id}`));
    assert.equal(resultado.videos[0].vistas,'2500');
    assert.equal(resultado.videos[0].likes,'85');
    assert.equal(resultado.videos[0].duracion,'PT1M12S');
    assert.deepEqual(resultado.videos[0].hashtags,['#Educación','#Comunidad']);
    assert.match(resultado.alcance,/no acredita residencia/);
    assert.ok(!JSON.stringify(resultado).includes('clave-youtube-'));
    assert.equal(peticiones.length,2);
  });
});

test('la caché comparte consultas equivalentes y separa país, tema y renovación de clave', async () => {
  let llamadas=0;
  await conFetch('clave-youtube-cache-simulada',async()=>{llamadas++;return {ok:true,json:async()=>({items:[]})};},async()=>{
    const resultados=await Promise.all(Array.from({length:20},()=>obtenerSenales('BO','  Educación   caché  ')));
    assert.equal(llamadas,1,'Solo una búsqueda externa para lectores simultáneos');
    assert.ok(resultados.every(r=>r===resultados[0]));
    assert.equal(resultados[0].videos.length,0);
    assert.equal(resultados[0].consulta,'Educación caché');
    assert.match(resultados[0].aviso,/no devolvió videos/);
    await obtenerSenales('BO','educación caché');
    assert.equal(llamadas,1);
    await obtenerSenales('US','educación caché');
    await obtenerSenales('US','otro tema caché');
    assert.equal(llamadas,3);
    process.env.YOUTUBE_API_KEY='clave-youtube-cache-renovada';
    await obtenerSenales('BO','educación caché');
    assert.equal(llamadas,4);
  });
});

test('sin tema conserva la selección popular sin consumir búsqueda y limita duplicados', async () => {
  let llamadas=0;
  await conFetch('clave-youtube-popular-simulada',async(url)=>{
    llamadas++; const u=new URL(url);
    assert.equal(u.pathname,'/youtube/v3/videos');
    assert.equal(u.searchParams.get('chart'),'mostPopular');
    assert.equal(u.searchParams.get('regionCode'),'MX');
    assert.equal(u.searchParams.get('q'),null);
    return {ok:true,json:async()=>({items:[item('abcDEF123_-'),item('abcDEF123_-'),item('../invalido')]})};
  },async()=>{
    const resultado=await obtenerSenales('MX');
    assert.equal(resultado.modo,'seleccion_popular');
    assert.equal(resultado.consulta,'');
    assert.equal(resultado.videos.length,1);
    assert.match(resultado.aviso,/sin filtro|no es un ranking/);
    assert.equal(llamadas,1);
  });
});

test('cuota, permisos y fallos no reflejan mensajes ni claves del proveedor ni disparan reintentos', async () => {
  const casos=[
    {key:'clave-error-cuota-youtube',respuesta:{ok:false,status:403,json:async()=>({error:{message:'secreto-cuota',errors:[{reason:'quotaExceeded'}]}})},patron:/cuota/},
    {key:'clave-error-permiso-youtube',respuesta:{ok:false,status:403,json:async()=>({error:{message:'secreto-permiso'}})},patron:/acceso/},
    {key:'clave-error-invalido-youtube',respuesta:{ok:true,json:async()=>({error:{message:'secreto-malformado'}})},patron:/correctamente/},
  ];
  for(const caso of casos) await conFetch(caso.key,async()=>caso.respuesta,async()=>{
    let error;
    try {await obtenerSenales('US','error de consulta');}catch(e){error=e;}
    assert.match(error.message,caso.patron);
    assert.ok(!error.message.includes('secreto'));
    assert.ok(!error.message.includes(caso.key));
  });
  let llamadas=0;
  await conFetch('clave-error-red-youtube',async()=>{llamadas++;throw new Error('secreto-incluido-en-url');},async()=>{
    await assert.rejects(obtenerSenales('US','error red'),e=>/conectar/.test(e.message)&&!e.message.includes('secreto'));
    assert.equal(llamadas,1);
  });
});

test('fallo de enriquecimiento conserva observaciones con métricas nulas y avisa del resultado parcial', async () => {
  await conFetch('clave-youtube-parcial-simulada',async(url)=>{
    if(new URL(url).pathname.endsWith('/search'))return {ok:true,json:async()=>({regionCode:'CA',items:[{id:{videoId:'abcDEF123_-'},snippet:item('abcDEF123_-').snippet}]})};
    return {ok:false,status:429,json:async()=>({error:{message:'secreto-no-divulgar'}})};
  },async()=>{
    const resultado=await obtenerSenales('US','educación parcial');
    assert.equal(resultado.conectado,true);
    assert.equal(resultado.parcial,true);
    assert.equal(resultado.regionAplicada,'CA');
    assert.match(resultado.aviso,/no se pudieron consultar/);
    assert.match(resultado.aviso,/cuota/);
    assert.match(resultado.aviso,/CA en lugar de US/);
    assert.equal(resultado.videos.length,1);
    assert.equal(resultado.videos[0].vistas,null);
    assert.equal(resultado.videos[0].likes,null);
    assert.equal(resultado.videos[0].duracion,null);
    assert.ok(!JSON.stringify(resultado).includes('secreto'));
  });
});

test('detalles omitidos y métricas inválidas no se convierten en evidencia inventada', async () => {
  await conFetch('clave-youtube-incompleto-simulada',async(url)=>{
    if(new URL(url).pathname.endsWith('/search'))return {ok:true,json:async()=>({items:[{id:{videoId:'abcDEF123_-'},snippet:item('abcDEF123_-').snippet},{id:{videoId:'ZYXwv987_-0'},snippet:item('ZYXwv987_-0').snippet}]})};
    return {ok:true,json:async()=>({items:[item('abcDEF123_-',{statistics:{viewCount:'no-numero',likeCount:-1},contentDetails:{duration:'valor inventado'}})]})};
  },async()=>{
    const resultado=await obtenerSenales('US','educación detalles incompletos');
    assert.equal(resultado.videos.length,1);
    assert.equal(resultado.parcial,true);
    assert.match(resultado.aviso,/se excluyeron/);
    assert.equal(resultado.videos[0].vistas,null);
    assert.equal(resultado.videos[0].likes,null);
    assert.equal(resultado.videos[0].duracion,null);
  });
});
