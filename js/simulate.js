// Simula partidas automáticas para ver cómo de difícil es el juego y qué cartas se ven.
import { Partida, LADOS } from './engine.js';

export function rngSemilla(semilla = 1) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "azar": elige a ciegas. "prudente": elige la opción que deja las barras más lejos de 0 y 100.
function decidir(partida, estrategia, rng) {
  if (estrategia === 'azar') return LADOS[rng() < 0.5 ? 0 : 1];
  let mejor = null;
  for (const lado of LADOS) {
    const d = partida.vistaPrevia(lado);
    let peor = Infinity;
    for (const [p, v] of Object.entries(partida.pilares)) {
      const n = v + (d[p] || 0);
      peor = Math.min(peor, n, 100 - n);
    }
    if (!mejor || peor > mejor.peor || (peor === mejor.peor && rng() < 0.5)) mejor = { lado, peor };
  }
  return mejor.lado;
}

export function simular(datos, { partidas = 1000, estrategia = 'prudente', semilla = 1, rasgo = 'azar' } = {}) {
  const rng = rngSemilla(semilla);
  const edades = [];
  const causas = {};
  const vistas = Object.fromEntries(datos.cartas.map((c) => [c.id, 0]));
  let cartasTotal = 0;
  let hitosTotal = 0;
  let pocosHitos = 0;
  const porRasgo = {};

  for (let i = 0; i < partidas; i++) {
    const r = rasgo === 'azar' ? datos.rasgos[Math.floor(rng() * datos.rasgos.length)].id : rasgo;
    const p = new Partida(datos, { sexo: rng() < 0.5 ? 'M' : 'F', rasgoId: r, rng });
    let guarda = 0;
    while (!p.fin && guarda++ < 2000) {
      const c = p.siguienteCarta();
      if (!c) break;
      vistas[c.id] += 1;
      cartasTotal += 1;
      p.elegir(decidir(p, estrategia, rng));
    }
    const fin = p.fin || { anio: p.anio, causa: { tipo: 'atasco' } };
    edades.push(fin.anio);
    const k = fin.causa.tipo === 'muerte' ? `${fin.causa.pilar} ${fin.causa.extremo}` : fin.causa.tipo;
    causas[k] = (causas[k] || 0) + 1;
    hitosTotal += p.hitos.length;
    if (p.hitos.length < 4) pocosHitos += 1;
    porRasgo[r] = porRasgo[r] || { partidas: 0, suma: 0 };
    porRasgo[r].partidas += 1;
    porRasgo[r].suma += fin.anio;
  }
  edades.sort((a, b) => a - b);
  const media = edades.reduce((a, b) => a + b, 0) / partidas;
  return {
    partidas,
    estrategia,
    edadMedia: Math.round(media * 10) / 10,
    mediana: edades[Math.floor(partidas / 2)],
    centenarios: Math.round(((causas.centenario || 0) / partidas) * 1000) / 10,
    causas: Object.entries(causas).sort((a, b) => b[1] - a[1]).map(([causa, n]) => ({ causa, pct: Math.round((n / partidas) * 1000) / 10 })),
    cartasPorPartida: Math.round((cartasTotal / partidas) * 10) / 10,
    hitosPorPartida: Math.round((hitosTotal / partidas) * 10) / 10,
    pctPocosHitos: Math.round((pocosHitos / partidas) * 1000) / 10,
    nuncaVistas: Object.entries(vistas).filter(([, n]) => n === 0).map(([id]) => id),
    vistas,
    porRasgo: Object.fromEntries(Object.entries(porRasgo).map(([k, v]) => [k, Math.round((v.suma / v.partidas) * 10) / 10])),
  };
}
