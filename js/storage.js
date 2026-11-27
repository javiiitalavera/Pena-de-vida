// Progreso guardado en este navegador (localStorage).
const CLAVE = 'muerte-subita:v1';
const VACIO = { desbloqueados: [], partidas: 0, record: 0, centenarios: 0, muertes: {} };

export function cargarProgreso() {
  try {
    return { ...VACIO, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') };
  } catch {
    return { ...VACIO };
  }
}

export function guardarProgreso(p) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch {
    /* modo privado o almacenamiento bloqueado: se juega sin guardar */
  }
}

export function registrarPartida(progreso, fin, nuevos) {
  const p = { ...progreso, muertes: { ...progreso.muertes } };
  p.partidas += 1;
  p.record = Math.max(p.record, fin.anio);
  if (fin.causa.tipo === 'centenario') p.centenarios += 1;
  const clave = fin.causa.tipo === 'muerte' ? `${fin.causa.pilar}_${fin.causa.extremo}` : fin.causa.tipo;
  p.muertes[clave] = (p.muertes[clave] || 0) + 1;
  p.desbloqueados = [...new Set([...p.desbloqueados, ...nuevos.map((r) => r.id)])];
  return p;
}
