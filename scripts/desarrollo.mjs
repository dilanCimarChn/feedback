import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [modo,...argumentos]=process.argv.slice(2);
if(!['produccion','local'].includes(modo))throw new Error('Selecciona desarrollo local o conectado a producción.');
const origen=modo==='produccion'?'https://feedback-sigma-one.vercel.app':'';
console.log(modo==='produccion'?'Interfaz local con APIs de producción: las consultas y los cambios de campañas usan datos reales.':'Interfaz y APIs locales: configura las credenciales de este equipo.');
const proceso=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url)),'--host','127.0.0.1',...argumentos],{stdio:'inherit',windowsHide:true,env:{...process.env,API_REMOTA_DESARROLLO:origen}});
proceso.on('error',()=>{console.error('No se pudo iniciar Vite. Comprueba que las dependencias estén instaladas.');process.exitCode=1;});
proceso.on('exit',codigo=>{process.exitCode=codigo??1;});
