import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarRadar,filtrarRadar,urlReferencia,fechaRadar} from '../src/lib/radar.js';
import {prepararCampana,editarPublicacion,aplicarPropuesta,referenciaManual,referenciaSeleccionada,fechasDelEquipo} from '../src/lib/campanas.js';
import {crearAgenda} from '../api/_lib/agenda-marketing.js';
import {crearRepositorioCampanas,validarAccesoEquipo,ErrorCampana,repositorioCampanas} from '../api/_lib/campanas-equipo.js';
import handler from '../api/campanas.js';
import regenerar from '../api/regenerar-publicacion.js';

const nueva=()=>({id:crypto.randomUUID(),nombre:'Campaña del equipo',inicio:'2026-11-17',fin:'2026-11-23',zona:'America/New_York',bloques:[],publicaciones:[{id:crypto.randomUUID(),fecha:'2026-11-18',hora:'12:00',red:'Facebook',formato:'Reel',titulo:'Educación accesible',copy:'Participa en el taller.',estado:'aprobado',hashtags:[],referencias:[]}]});
function memoria(){let datos={campanas:{},referencias:[]},version=0;return {async leer(){await Promise.resolve();return {datos:structuredClone(datos),etag:version||null};},async escribir(d,etag){await Promise.resolve();if((version||null)!==etag)throw new ErrorCampana('Conflicto',409);datos=structuredClone(d);version++;}};}
const res=()=>({status(c){this.code=c;return this;},json(d){this.data=d;return this;},setHeader(k,v){this[k]=v;}});

test('el radar separa métricas propias, fechas desconocidas y referencias manuales sin inventar crecimiento o geolocalización',()=>{
  const datos={pais:'US',tema:'educación',consultado:'2026-11-17T12:00:00Z',youtube:{modo:'busqueda_tematica',alcance:'Primera página, sin ranking.'},videos:[{titulo:'Education',url:'https://youtube.com/watch?v=abcdefghijk',publicado:'2026-11-15T12:00:00Z',vistas:'12'}],noticias:[{titulo:'Escuela',url:'https://example.com/escuela',fecha:'20261116T120000Z',idioma:'English'}],referenciasManuales:[{titulo:'Voluntariado',url:'https://facebook.com/1',plataforma:'Facebook'}],plataformas:[{fuente:'Instagram',items:[{titulo:'Propia',url:'https://instagram.com/p/propia/'}]}]};
  const r=normalizarRadar(datos);assert.equal(r.length,4);assert.equal(r[0].region,null);assert.equal(r[0].metricas.vistas,'12');assert.ok(!Object.hasOwn(r[0].metricas,'crecimiento'));assert.equal(r[1].publicado,'2026-11-16T12:00:00.000Z');assert.equal(r[1].idioma,'English');assert.equal(r[2].senal.confianza,'Por revisar');assert.equal(filtrarRadar(r).length,3);assert.equal(filtrarRadar(r,{categoria:'Educación',texto:'school'}).length,0);assert.equal(filtrarRadar(r,{desde:'2026-11-16'}).length,2);assert.equal(filtrarRadar(r,{plataforma:'Facebook'})[0].publicado,null);assert.equal(fechaRadar('imposible'),null);
  assert.equal(urlReferencia('javascript:alert(1)'), '');assert.equal(urlReferencia('https://example.com/?access_token=secreto'),'');assert.equal(urlReferencia('https://usuario:clave@example.com/'),'');
});

test('edición y alternativas conservan identificadores, recuperan versión previa y devuelven aprobados a borrador',()=>{
  const original={...nueva(),_equipo:{revision:4,pendiente:false}},id=original.publicaciones[0].id;
  const editada=editarPublicacion(original,id,{copy:'Texto revisado'});assert.equal(original.publicaciones[0].copy,'Participa en el taller.');assert.equal(editada.publicaciones[0].estado,'borrador');assert.equal(editada._equipo.pendiente,true);
  assert.equal(editarPublicacion(editada,id,{estado:'pendiente_revision'}).publicaciones[0].estado,'pendiente_revision');
  const aplicada=aplicarPropuesta(editada,id,{...editada.publicaciones[0],fecha:'2027-01-01',red:'X',copy:'Alternativa'}).publicaciones[0];assert.equal(aplicada.fecha,'2026-11-18');assert.equal(aplicada.red,'Facebook');assert.equal(aplicada.id,id);assert.equal(aplicada.versionAnterior.copy,'Texto revisado');
  const cambio=editarPublicacion(original,id,{red:'YouTube'}).publicaciones[0];assert.equal(cambio.formato,'Clip');assert.match(cambio.base_horario,/equipo/);
  const limpia=prepararCampana({...original,access_token:'secreto',perfil:{apiKey:'oculta'},bloques:[{publicaciones:original.publicaciones,evidencia:{}}]});assert.ok(!JSON.stringify(limpia).includes('secreto'));assert.ok(!limpia._equipo);assert.ok(!limpia.bloques[0].publicaciones);
  assert.throws(()=>prepararCampana({...original,publicaciones:[{...original.publicaciones[0],formato:'Texto'}]}),/formato/);
  assert.throws(()=>prepararCampana({...original,publicaciones:[{...original.publicaciones[0],copy:''}]}),/aprobar/);
  assert.throws(()=>referenciaManual({plataforma:'Facebook',url:'https://example.com/',titulo:'Prueba'}),/plataforma/);
  assert.equal(referenciaSeleccionada({plataforma:'GDELT',url:'https://example.com/noticia',titulo:'Noticia'}).plataforma,'GDELT');
  assert.equal(fechasDelEquipo('2026-11-20 | Taller',original.inicio,original.fin)[0].nombre,'Taller');assert.throws(()=>fechasDelEquipo('2026-11-31 | Error',original.inicio,original.fin));
});

test('solo las plataformas elegidas reciben publicaciones y las cuotas se conservan entre bloques',()=>{
  const args={origen:'2026-11-17',finCampana:'2026-11-30',totalPublicaciones:10,redes:['YouTube','Facebook'],zona:'UTC'};
  const a=crearAgenda({...args,inicio:args.origen,fin:'2026-11-23',cantidadPublicaciones:5}),b=crearAgenda({...args,inicio:'2026-11-24',fin:args.finCampana,cantidadPublicaciones:5});assert.equal(a.length+b.length,10);assert.ok([...a,...b].every(p=>args.redes.includes(p.red)));assert.ok([...a,...b].filter(p=>p.red==='Facebook').length>[...a,...b].filter(p=>p.red==='YouTube').length);assert.throws(()=>crearAgenda({...args,inicio:args.origen,fin:'2026-11-23',redes:[]}));
});

test('dos equipos comparten calendarios; una versión antigua devuelve conflicto y mantiene el último contenido',async()=>{
  const repo=crearRepositorioCampanas(memoria()),plan=nueva();const guardada=await repo.ejecutar({accion:'guardar',plan,revision:0});assert.equal(guardada.revision,1);
  const otra=await repo.ejecutar({accion:'abrir',id:plan.id});otra.plan.publicaciones[0].copy='Actualizado por el equipo';await repo.ejecutar({accion:'guardar',plan:otra.plan,revision:1});
  await assert.rejects(repo.ejecutar({accion:'guardar',plan,revision:1}),e=>e.status===409);assert.equal((await repo.ejecutar({accion:'abrir',id:plan.id})).plan.publicaciones[0].copy,'Actualizado por el equipo');assert.equal((await repo.ejecutar({accion:'listar'})).campanas[0].revision,2);
});

test('las escrituras simultáneas de campañas diferentes se fusionan y las de la misma revisión se rechazan',async()=>{
  const repo=crearRepositorioCampanas(memoria()),a=nueva(),b=nueva();await Promise.all([repo.ejecutar({accion:'guardar',plan:a,revision:0}),repo.ejecutar({accion:'guardar',plan:b,revision:0})]);assert.equal((await repo.ejecutar({accion:'listar'})).campanas.length,2);
  const resultados=await Promise.allSettled([repo.ejecutar({accion:'guardar',plan:a,revision:1}),repo.ejecutar({accion:'guardar',plan:a,revision:1})]);assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1);assert.equal(resultados.find(r=>r.status==='rejected').reason.status,409);
  const referencia={plataforma:'Facebook',url:'https://facebook.com/page/posts/1',titulo:'Referencia'};await Promise.all([repo.ejecutar({accion:'referencia',referencia}),repo.ejecutar({accion:'referencia',referencia})]);assert.equal((await repo.ejecutar({accion:'listar'})).referencias.length,1);
  await assert.rejects(repo.ejecutar({accion:'guardar',plan:{},revision:0}),e=>e.status===400);
});

test('los calendarios requieren acceso del equipo y el estado público no devuelve datos',async()=>{
  const prev={EQUIPO_CODIGO_ACCESO:process.env.EQUIPO_CODIGO_ACCESO,BLOB_READ_WRITE_TOKEN:process.env.BLOB_READ_WRITE_TOKEN};
  try {process.env.EQUIPO_CODIGO_ACCESO='prueba-equipo';process.env.BLOB_READ_WRITE_TOKEN='solo-prueba';let r=res();assert.equal(validarAccesoEquipo({method:'GET',headers:{}},r),false);assert.equal(r.code,405);r=res();await handler({method:'POST',body:{accion:'listar'},headers:{}},r);assert.equal(r.code,401);assert.equal(r.data.codigoRequerido,true);r=res();await handler({method:'POST',body:{accion:'estado'},headers:{}},r);assert.equal(r.data.disponible,true);assert.ok(!r.data.campanas);r=res();assert.equal(validarAccesoEquipo({method:'POST',headers:{'x-codigo-acceso':'prueba-equipo'}},r),true);assert.equal(r['Cache-Control'],'private, no-store');}
  finally{for(const [k,v] of Object.entries(prev))v===undefined?delete process.env[k]:process.env[k]=v;}
});

test('regenerar devuelve una alternativa sin escribir ni cambiar la agenda y rechaza versiones antiguas antes de usar IA',async()=>{
  const prev=Object.fromEntries(['EQUIPO_CODIGO_ACCESO','APP_ACCESS_CODE','BLOB_READ_WRITE_TOKEN','GEMINI_API_KEY'].map(k=>[k,process.env[k]])),fetch=globalThis.fetch,ejecutar=repositorioCampanas.ejecutar;
  try {
    Object.assign(process.env,{EQUIPO_CODIGO_ACCESO:'equipo',APP_ACCESS_CODE:'otro-codigo',BLOB_READ_WRITE_TOKEN:'prueba',GEMINI_API_KEY:'prueba'});
    const plan=nueva(),original=structuredClone(plan);let llamadas=0;
    repositorioCampanas.ejecutar=async b=>{assert.equal(b.accion,'abrir');return {plan,revision:3};};
    globalThis.fetch=async()=>{llamadas++;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({titulo:'Otra idea',gancho:'Aprender',guion:'Dos escenas',copy:'Nuevo borrador',cta:'Comenta',metrica:'Comentarios',motivo:'Hipótesis editorial',visual:'Paleta de la marca',distribucion:'Perfil propio',referencias:[],hashtags:['#Escuela'],palabras_clave:['educación']})}]}}]})};};
    const invocar=async revision=>{const r=res();await regenerar({method:'POST',headers:{'x-codigo-acceso':'equipo'},body:{id:plan.id,revision,publicacionId:plan.publicaciones[0].id}},r);return r;};
    assert.equal((await invocar(2)).code,409);assert.equal(llamadas,0);const r=await invocar(3);assert.equal(r.code,200);assert.equal(r.data.guardada,false);assert.equal(r.data.propuesta.fecha,original.publicaciones[0].fecha);assert.equal(r.data.propuesta.estado,'borrador');assert.equal(r.data.propuesta.copy,'Nuevo borrador');assert.deepEqual(plan,original);assert.equal(llamadas,1);
  }finally{globalThis.fetch=fetch;repositorioCampanas.ejecutar=ejecutar;for(const [k,v] of Object.entries(prev))v===undefined?delete process.env[k]:process.env[k]=v;}
});
