const DIA = 86400000;

export const PERIODOS_CAMPANA = [
  { id:'dia', cantidad:1, unidad:'dias', nombre:'1 día' },
  { id:'semana', cantidad:1, unidad:'semanas', nombre:'1 semana' },
  { id:'mes', cantidad:1, unidad:'meses', nombre:'1 mes' },
  { id:'trimestre', cantidad:3, unidad:'meses', nombre:'3 meses · recomendado' },
  { id:'semestre', cantidad:6, unidad:'meses', nombre:'6 meses' },
  { id:'ano', cantidad:1, unidad:'anos', nombre:'1 año · máximo' }
];
export const MAXIMO_POR_UNIDAD = { dias:366, semanas:52, meses:12, anos:1 };

export function periodoSeleccionado(form) {
  if(form.modo==='mes') return 'mes_completo';
  if(form.modo==='personalizado') return 'personalizado';
  return PERIODOS_CAMPANA.find(p=>p.cantidad===Number(form.cantidad)&&p.unidad===form.unidad)?.id || 'personalizado';
}

export function mesSiguiente(ahora = new Date()) {
  const fecha = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

export function rangoMes(mes, maxAno = 2100) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes || '')) throw new Error('Elige un mes válido.');
  const [ano, numero] = mes.split('-').map(Number);
  if (ano < 2020 || ano > maxAno) throw new Error(`Elige un año entre 2020 y ${maxAno}.`);
  const dias = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fin: `${mes}-${dias}`, dias };
}

export function cantidadAutomatica(dias) {
  return Math.max(1, Math.round(dias * 5 / 7));
}

// Distribuye la cantidad de la campaña completa sin redondear cada semana por separado.
export function cuposPorBloque(bloques, cantidad) {
  if (!Number.isInteger(cantidad) || cantidad < 1 || !bloques.length) throw new Error('Indica una cantidad de publicaciones válida.');
  const dias = bloques.map(b => (Date.parse(b.fin) - Date.parse(b.inicio)) / DIA + 1);
  if (dias.some(d => !Number.isInteger(d) || d < 1)) throw new Error('Períodos no válidos.');
  const totalDias = dias.reduce((s, n) => s + n, 0);
  let acumulados = 0, asignadas = 0;
  return dias.map(d => {
    acumulados += d;
    const hasta = Math.round(cantidad * acumulados / totalDias);
    const cupo = hasta - asignadas;
    asignadas = hasta;
    return cupo;
  });
}

export function celdasMes(mes) {
  // Una campaña que empieza en 2100 puede terminar en 2101.
  const rango = rangoMes(mes, 2101);
  const desplazamiento = new Date(`${rango.inicio}T00:00:00Z`).getUTCDay();
  const fechas = Array.from({ length: rango.dias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
  const celdas = [...Array(desplazamiento).fill(null), ...fechas];
  while (celdas.length % 7) celdas.push(null);
  return celdas;
}
