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

// Las últimas vidas, para el archivo de difuntos (la más reciente primero).
export function archivarVida(progreso, ficha, max = 30) {
  return { ...progreso, archivo: [ficha, ...(progreso.archivo || [])].slice(0, max) };
}

// Nivel de dificultad elegido en Ajustes.
const CLAVE_NIVEL = 'muerte-subita:nivel';

export function cargarNivel() {
  try {
    return localStorage.getItem(CLAVE_NIVEL);
  } catch {
    return null;
  }
}

export function guardarNivel(id) {
  try {
    localStorage.setItem(CLAVE_NIVEL, id);
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
}

// Partida en curso: se guarda tras cada carta para poder continuar si el navegador recarga.
const CLAVE_PARTIDA = 'muerte-subita:partida';

export function guardarPartida(estado) {
  try {
    localStorage.setItem(CLAVE_PARTIDA, JSON.stringify(estado));
  } catch {
    /* sin almacenamiento: no se puede continuar luego */
  }
}

export function cargarPartida() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PARTIDA) || 'null');
  } catch {
    return null;
  }
}

export function borrarPartida() {
  try {
    localStorage.removeItem(CLAVE_PARTIDA);
  } catch {
    /* nada */
  }
}
