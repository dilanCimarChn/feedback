import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarFacebookExterno} from '../api/_lib/descubrimiento-social.js';
import {investigarMarketing} from '../api/_lib/investigacion-marketing.js';
import {catalogarFuentes,justificarPieza} from '../api/_lib/precision-marketing.js';
import {obtenerSenales} from '../api/_lib/senales-sociales.js';

test('Facebook sigue pendiente ante rechazo o ausencia de publicaciones externas',async()=>{
  const nombres=['FACEBOOK_DISCOVERY_PAGE_IDS','FACEBOOK_PUBLIC_ACCESS_TOKEN','META_GRAPH_VERSION','FACEBOOK_PAGE_ID'];
  const anterior=Object.fromEntries(nombres.map(k=>[k,process.env[k]])),original=globalThis.fetch;
  try{
    Object.assign(process.env,{FACEBOOK_DISCOVERY_PAGE_IDS:'991123',FACEBOOK_PUBLIC_ACCESS_TOKEN:'test-publico-100',META_GRAPH_VERSION:'v25.0',FACEBOOK_PAGE_ID:'991124'});
    globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({error:{code:100,message:'mensaje privado'}})});
    const rechazo=await consultarFacebookExterno();assert.match(rechazo.estado,/Pendiente de acceso/);assert.deepEqual(rechazo.items,[]);assert.ok(!JSON.stringify(rechazo).includes('mensaje privado'));
    process.env.FACEBOOK_PUBLIC_ACCESS_TOKEN='test-publico-vacio';
    globalThis.fetch=async()=>({ok:true,json:async()=>({data:[]})});
    assert.match((await consultarFacebookExterno()).estado,/Pendiente de acceso/);
    process.env.FACEBOOK_DISCOVERY_PAGE_IDS=process.env.FACEBOOK_PAGE_ID;
    globalThis.fetch=async()=>{throw new Error('No debe consultar la pagina propia');};
    assert.match((await consultarFacebookExterno()).estado,/Pendiente de acceso/);
  }finally{globalThis.fetch=original;for(const [k,v] of Object.entries(anterior))v===undefined?delete process.env[k]:process.env[k]=v;}
});

test('radar sin redes disponibles excluye cuentas propias y no consulta TikTok aunque tenga credenciales',async()=>{
  const nombres=Object.keys(process.env).filter(k=>/^(YOUTUBE_|META_|FACEBOOK_|INSTAGRAM_|TIKTOK_)/.test(k));
  const anterior=Object.fromEntries(nombres.map(k=>[k,process.env[k]])),original=globalThis.fetch;
  try{
    nombres.forEach(k=>delete process.env[k]);process.env.TIKTOK_DISCOVERY_ACCESS_TOKEN='no-consultar';process.env.TIKTOK_DISCOVERY_BUSINESS_ID='prueba';
    let llamadasTikTok=0;
    globalThis.fetch=async url=>{if(String(url).includes('tiktok'))llamadasTikTok++;throw new Error('Fuentes pendientes');};
    const datos=await investigarMarketing('BO','educacion prueba radar independiente');
    assert.equal(datos.estados.find(f=>f.fuente==='TikTok').estado,'Pendiente');assert.equal(llamadasTikTok,0);assert.deepEqual(datos.plataformas,[]);assert.deepEqual(datos.resultados,[]);
  }finally{globalThis.fetch=original;delete process.env.TIKTOK_DISCOVERY_ACCESS_TOKEN;delete process.env.TIKTOK_DISCOVERY_BUSINESS_ID;for(const [k,v] of Object.entries(anterior))process.env[k]=v;}
});

test('el calendario conserva enlaces externos y rechaza enlaces con secretos o fuentes inventadas',()=>{
  const url='https://www.instagram.com/p/EDUCACION/';
  const catalogo=catalogarFuentes({descubrimientos:[{fuente:'Instagram',items:[{titulo:'Educacion',url},{titulo:'No usar',url:'https://example.org/?access_token=secreto'}]}],plataformas:[{fuente:'Facebook',items:[{titulo:'Propia',url:'https://facebook.com/propia'}]}]});
  assert.equal(catalogo.length,1);assert.equal(catalogo[0].url,url);
  const pieza=justificarPieza({fecha:'2026-11-19',referencias:['F1']},catalogo,'2026-11-18');assert.equal(pieza.referencias[0].url,url);
  assert.throws(()=>justificarPieza({fecha:'2026-11-19',referencias:['F2']},catalogo,'2026-11-18'));
});

test('YouTube busca por canal y periodo y delimita el orden por vistas sin clave',async()=>{
  const anterior=process.env.YOUTUBE_API_KEY;delete process.env.YOUTUBE_API_KEY;
  try{const r=await obtenerSenales('BO','',{dias:7,orden:'viewCount',canalId:'UC'+'a'.repeat(22)});assert.equal(r.modo,'busqueda_tematica');assert.match(r.etiqueta,/entre los resultados/);assert.match(r.etiqueta,/7/);assert.equal(r.conectado,false);}
  finally{anterior===undefined?delete process.env.YOUTUBE_API_KEY:process.env.YOUTUBE_API_KEY=anterior;}
});

test('YouTube aplica canal y ventana temporal antes de ordenar las vistas verificadas',async()=>{
  const anterior=process.env.YOUTUBE_API_KEY,original=globalThis.fetch;process.env.YOUTUBE_API_KEY='prueba-canal-periodo';
  const canal='UC'+'b'.repeat(22),publicado=new Date(Date.now()-86400000).toISOString(),ids=['abcdefghijk','lmnopqrstuv'];let busquedas=0;
  try{
    globalThis.fetch=async url=>{const u=new URL(url);if(u.pathname.endsWith('/search')){busquedas++;assert.equal(u.searchParams.get('channelId'),canal);assert.equal(u.searchParams.get('order'),'viewCount');assert.ok(Date.parse(u.searchParams.get('publishedAfter'))<Date.parse(publicado));assert.ok(Date.parse(u.searchParams.get('publishedBefore'))>Date.parse(publicado));return {ok:true,json:async()=>({items:ids.map(id=>({id:{videoId:id},snippet:{title:'Educacion',publishedAt:publicado}}))})};}return {ok:true,json:async()=>({items:ids.map((id,i)=>({id,snippet:{title:'Educacion',publishedAt:publicado,channelId:canal},statistics:{viewCount:i?'500':'20'}}))})};};
    const r=await obtenerSenales('BO','',{dias:7,canalId:canal,orden:'viewCount'});assert.equal(busquedas,1);assert.deepEqual(r.videos.map(v=>v.vistas),['500','20']);assert.ok(r.videos.every(v=>v.url.startsWith('https://www.youtube.com/watch?v=')&&v.publicado===publicado));assert.match(r.etiqueta,/entre los resultados/);
  }finally{globalThis.fetch=original;anterior===undefined?delete process.env.YOUTUBE_API_KEY:process.env.YOUTUBE_API_KEY=anterior;}
});
