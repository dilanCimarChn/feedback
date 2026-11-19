import {limitarFuentes} from './carga.js';
import {urlReferencia} from '../../src/lib/radar.js';

const DIRECCION='https://api.gdeltproject.org/api/v2/doc/doc';
const PRESUPUESTO_MS=12000;
// GDELT es público: una cuota 429 pausa todas las consultas de este proceso.
const pausaCompartida={hasta:0};

export class ErrorGdelt extends Error {
  constructor(causa,mensaje,codigoHttp=null,reintentarEn=null){
    super(mensaje);
    this.causa=causa;
    this.codigoHttp=codigoHttp;
    this.reintentarEn=reintentarEn;
  }
}

const demora=()=>new ErrorGdelt('tiempo_agotado','GDELT agotó el tiempo de consulta de noticias. El proveedor puede estar lento o no disponible; las otras fuentes siguen disponibles.');

function esperaProveedor(respuesta,instante){
  const valor=respuesta.headers?.get?.('retry-after');
  const numero=valor===null||valor===undefined||valor.trim()===''?NaN:Number(valor);
  const segundos=Number.isFinite(numero)?numero:valor?(Date.parse(valor)-instante)/1000:NaN;
  return Number.isFinite(segundos)?Math.max(1,Math.min(300,Math.ceil(segundos))):60;
}
const errorPausa=segundos=>new ErrorGdelt('limite_consultas',`GDELT limitó temporalmente las consultas de noticias (HTTP 429). Vuelve a consultar en ${segundos} segundos; no se hacen reintentos automáticos.`,429,segundos);

/** Consulta noticias públicas con un presupuesto compartido, incluida la ampliación de localidad. */
export async function buscarNoticiasGdelt({consulta,consultaNacional=consulta,region='',dias=7,tiempoMs=PRESUPUESTO_MS,fetchImpl=globalThis.fetch,ahora=Date.now,pausa=pausaCompartida}={}){
  const comprobarPausa=()=>{
    const restantes=Math.ceil((pausa.hasta-ahora())/1000);
    if(restantes>0)throw errorPausa(Math.min(300,restantes));
  };
  comprobarPausa();
  const limite=ahora()+Math.max(1,Math.min(PRESUPUESTO_MS,tiempoMs));
  const leer=async query=>limitarFuentes(async()=>{
    comprobarPausa();
    const restante=limite-ahora();
    if(restante<=0)throw demora();
    const signal=AbortSignal.timeout(Math.max(1,Math.ceil(restante)));
    const parametros=new URLSearchParams({query,mode:'artlist',format:'json',timespan:`${dias}d`,maxrecords:'10',sort:'datedesc'});
    let respuesta;
    try{respuesta=await fetchImpl(`${DIRECCION}?${parametros}`,{headers:{Accept:'application/json'},signal});}
    catch(error){
      if(signal.aborted||['AbortError','TimeoutError'].includes(error?.name))throw demora();
      throw new ErrorGdelt('sin_conexion','No se pudo conectar con GDELT. Las otras fuentes y el calendario siguen disponibles.');
    }
    if(!respuesta.ok){
      const estado=Number(respuesta.status)||null;
      if(estado===429){
        const segundos=esperaProveedor(respuesta,ahora());
        pausa.hasta=ahora()+segundos*1000;
        throw errorPausa(segundos);
      }
      if(estado===400||estado===422)throw new ErrorGdelt('consulta_rechazada',`GDELT rechazó los parámetros de búsqueda (HTTP ${estado}). Prueba un tema más concreto.`,estado);
      throw new ErrorGdelt('error_proveedor',`GDELT no pudo atender la consulta${estado?` (HTTP ${estado})`:''}. Las otras fuentes siguen disponibles.`,estado);
    }
    let datos;
    try{
      // GDELT puede responder HTTP 200 con un mensaje de error en texto en vez de JSON.
      if(typeof respuesta.text==='function'){
        const cuerpo=await respuesta.text();
        try{datos=JSON.parse(cuerpo);}
        catch{
          const consultaInvalida=/query|keyword|phrase|operator|syntax|parenthes/i.test(cuerpo.slice(0,1500));
          throw new ErrorGdelt(consultaInvalida?'consulta_rechazada':'respuesta_no_valida',consultaInvalida?'GDELT rechazó la expresión de búsqueda; no devolvió noticias JSON. Prueba un tema más concreto.':'GDELT devolvió una respuesta que no es JSON de noticias. El proveedor puede estar temporalmente no disponible.');
        }
      }else datos=await respuesta.json();
    }catch(error){
      if(error instanceof ErrorGdelt)throw error;
      if(signal.aborted||['AbortError','TimeoutError'].includes(error?.name))throw demora();
      throw new ErrorGdelt('respuesta_no_valida','GDELT devolvió datos que no se pudieron interpretar como noticias.');
    }
    if(!Array.isArray(datos?.articles))throw new ErrorGdelt('respuesta_no_valida','GDELT no devolvió una lista válida de noticias. No se interpreta como una búsqueda sin resultados.');
    const vistos=new Set();
    return datos.articles.flatMap(articulo=>{
      const url=urlReferencia(articulo?.url);
      if(!url||vistos.has(url)||typeof articulo.title!=='string'||!articulo.title.trim())return [];
      vistos.add(url);
      return [{titulo:articulo.title.trim().slice(0,1000),url,fecha:typeof articulo.seendate==='string'?articulo.seendate:null,idioma:typeof articulo.language==='string'?articulo.language:null}];
    }).slice(0,10);
  });
  const noticias=await leer(consulta);
  if(noticias.length||!region)return {noticias,consulta,nivel:region?'Localidad solicitada':'País solicitado'};
  const nacionales=await leer(consultaNacional);
  return {noticias:nacionales,consulta:consultaNacional,nivel:'País solicitado; sin resultados para la localidad'};
}
