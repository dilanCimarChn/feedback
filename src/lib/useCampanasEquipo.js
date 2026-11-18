import {useEffect,useRef,useState} from 'react';
import {llamarApi} from './api';
import {prepararCampana,firmaCampana} from './campanas';

export function useCampanasEquipo(plan,setPlan) {
  const [disponible,setDisponible]=useState(null),[campanas,setCampanas]=useState([]),[referencias,setReferencias]=useState([]),[mensaje,setMensaje]=useState(''),[guardando,setGuardando]=useState(false);
  const actual=useRef(plan),estado=useRef(false);
  actual.current=plan;
  useEffect(()=>{let viva=true;llamarApi('/api/campanas',{accion:'estado'}).then(r=>{if(viva){estado.current=r.disponible;setDisponible(r.disponible);}}).catch(()=>{if(viva){setDisponible(false);setMensaje('No se pudo comprobar la conexión del equipo. El borrador local sigue disponible.');}});return()=>{viva=false;};},[]);
  const refrescar=async()=>{try{const r=await llamarApi('/api/campanas',{accion:'listar'});setCampanas(r.campanas);setReferencias(r.referencias||[]);setMensaje('Campañas del equipo actualizadas.');return r;}catch(e){setMensaje(e.message);throw e;}};
  const guardar=async(entrada=actual.current,copia=false)=>{
    if(!entrada)return;
    const snapshot=prepararCampana({...entrada,id:copia?crypto.randomUUID():entrada.id,nombre:copia?`${entrada.nombre||'Campaña'} · copia`:entrada.nombre});
    const firma=firmaCampana(entrada);
    setGuardando(true);setMensaje('Guardando en el equipo…');
    try {
      const revision=copia?0:entrada._equipo?.revision||0;
      const r=await llamarApi('/api/campanas',{accion:'guardar',plan:snapshot,revision});
      setPlan(p=>firmaCampana(p)===firma?{...r.plan,_equipo:{revision:r.revision,pendiente:false,actualizado:r.actualizado}}:{...p,id:r.plan.id,_equipo:{revision:r.revision,pendiente:true,actualizado:r.actualizado}});
      setMensaje('Calendario guardado y disponible para el equipo.');
      setCampanas(f=>[{id:r.plan.id,nombre:r.plan.nombre,inicio:r.plan.inicio,fin:r.plan.fin,publicaciones:r.plan.publicaciones.length,revision:r.revision,actualizado:r.actualizado},...f.filter(c=>c.id!==r.plan.id)]);
      return r;
    }catch(e){setMensaje(e.message);throw e;}finally{setGuardando(false);}
  };
  const abrir=async id=>{
    if(actual.current&&(!actual.current._equipo||actual.current._equipo.pendiente))throw new Error('Guarda los cambios actuales o una copia antes de abrir otra campaña.');
    const r=await llamarApi('/api/campanas',{accion:'abrir',id});
    setPlan({...r.plan,_equipo:{revision:r.revision,pendiente:false,actualizado:r.actualizado}});
    setMensaje('Campaña del equipo abierta.');return r.plan;
  };
  const guardarReferencia=async referencia=>{const r=await llamarApi('/api/campanas',{accion:'referencia',referencia});setReferencias(f=>f.some(x=>x.url===r.referencia.url)?f:[...f,r.referencia]);return r.referencia;};
  return {disponible,campanas,referencias,mensaje,guardando,guardar,abrir,refrescar,guardarReferencia,estaDisponible:()=>estado.current};
}
