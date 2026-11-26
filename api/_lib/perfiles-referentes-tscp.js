import { crearReferentesTscp } from '../../src/lib/agente-tscp.js';

// Enlaces contrastados con los sitios oficiales el 25 de noviembre de 2026.
// Este catálogo identifica perfiles; no acredita lectura de sus publicaciones.
export const PERFILES_REFERENTES_TSCP = [
  { nombre: 'Good360', origen: 'https://good360.org/wp-content/uploads/2026/05/2026-Health-Hygiene-Report.pdf', perfiles: { LinkedIn: 'https://www.linkedin.com/company/good360/', Instagram: 'https://www.instagram.com/good360usa/', Facebook: 'https://www.facebook.com/Good360.org' } },
  { nombre: 'TechSoup', origen: 'https://blog.techsoup.org/en-us/posts', perfiles: { LinkedIn: 'https://www.linkedin.com/company/techsoup', Instagram: 'https://www.instagram.com/techsoup/', Facebook: 'https://www.facebook.com/TechSoup' } },
  { nombre: 'charity: water', origen: 'https://www.charitywater.org/', perfiles: { LinkedIn: 'https://www.linkedin.com/company/charity-water', Instagram: 'https://www.instagram.com/charitywater/', Facebook: 'https://www.facebook.com/charitywater' } },
  { nombre: 'American Red Cross', origen: 'https://www.redcross.org/', perfiles: { TikTok: 'https://www.tiktok.com/@americanredcross' } },
  { nombre: 'Doctors Without Borders', origen: 'https://www.doctorswithoutborders.org/', perfiles: { TikTok: 'https://www.tiktok.com/@doctorswithoutborders' } },
  { nombre: 'UNICEF', origen: 'https://www.unicef.org/', perfiles: { TikTok: 'https://www.tiktok.com/@unicef' } },
];

const canon = valor => String(valor || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const mismoPerfil = (a, b) => String(a || '').toLowerCase().replace('://www.', '://').replace(/\/$/, '') === String(b || '').toLowerCase().replace('://www.', '://').replace(/\/$/, '');

export function resolverReferentesTscp(referentes, redes) {
  const entrada = referentes.length ? referentes : crearReferentesTscp().filter(r => redes.includes(r.canal));
  const salida = [];
  for (const canal of redes) {
    const opciones = PERFILES_REFERENTES_TSCP.filter(o => o.perfiles[canal]);
    const registros = entrada.filter(r => r.canal === canal).map(r => ({ ...r }));
    const usados = new Set(registros.filter(r => r.url).map(r => opciones.find(o => mismoPerfil(o.perfiles[canal], r.url))?.nombre).filter(Boolean));
    const completar = (r, org, sustituye) => ({
      ...r, nombre: sustituye ? org.nombre : r.nombre, url: r.url || org.perfiles[canal],
      cuenta: r.cuenta || (canal === 'Instagram' ? new URL(org.perfiles[canal]).pathname.split('/').filter(Boolean)[0] : ''),
      identificacion: { origen: 'Sitio oficial del referente', url: org.origen, consultado: '2026-11-25', estado: 'Enlazado desde el sitio oficial', ...(sustituye ? { sustituye, motivo: `No se localizó un perfil oficial de ${sustituye} en ${canal}; se propone ${org.nombre} como referente de comunicación de una ONG.` } : {}) },
    });
    for (let i = 0; i < registros.length; i++) {
      const r = registros[i];
      if (r.url) {
        const org = opciones.find(o => mismoPerfil(o.perfiles[canal], r.url) && canon(o.nombre) === canon(r.nombre));
        if (org) registros[i] = completar(r, org);
        continue;
      }
      const exacta = opciones.find(o => canon(o.nombre) === canon(r.nombre));
      const esCandidatoInicial = r.id === `${canal.toLowerCase()}-${canon(r.nombre) === 'good360' ? 1 : 2}` && ['good360', 'techsoup'].includes(canon(r.nombre));
      const sinObservaciones = r.seguidores == null && !r.publicaciones?.length && !r.cuenta && !r.paginaId;
      const alternativa = !exacta && esCandidatoInicial && sinObservaciones ? opciones.find(o => !usados.has(o.nombre)) : null;
      const org = exacta && !usados.has(exacta.nombre) ? exacta : alternativa;
      if (!org) continue;
      registros[i] = completar(r, org, alternativa ? r.nombre : null);
      usados.add(org.nombre);
    }
    for (const org of opciones) {
      if (registros.length >= 3) break;
      if (usados.has(org.nombre) || registros.some(r => canon(r.nombre) === canon(org.nombre))) continue;
      let id = `auto-${canal.toLowerCase()}-${canon(org.nombre)}`;
      while (entrada.some(r => r.id === id) || salida.some(r => r.id === id) || registros.some(r => r.id === id)) id += '-2';
      registros.push(completar({ id, canal, nombre: org.nombre, url: '', cuenta: '', paginaId: '', seguidores: null, publicaciones: [], fechaConsulta: null, periodoDias: 30 }, org));
      usados.add(org.nombre);
    }
    salida.push(...registros);
  }
  return salida;
}
