#!/usr/bin/env node
// Uso: node tools/revisar.mjs            -> validación + simulación
//      node tools/revisar.mjs --solo-validar
// Sale con código 1 si hay errores (lo usa GitHub Actions).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cargarDatosCon } from '../js/data.js';
import { validar } from '../js/validate.js';
import { simular } from '../js/simulate.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datos = await cargarDatosCon(async (ruta) => JSON.parse(await readFile(path.join(raiz, ruta), 'utf8')));
const { errores, avisos, resumen } = validar(datos);

console.log(`\n== Cartas: ${resumen.total} (objetivo de ritmo completo ≈ ${resumen.objetivoTotal}) ==`);
console.table(
  Object.fromEntries(
    resumen.etapas.map((e) => [e.id, { años: e.anios, etapa: e.etapa, anclas: e.anclas, ambos: e.ambos, soloM: e.soloM, soloF: e.soloF, condic: e.condicionadas, objetivo: e.objetivo, 'cobertura%': e.cobertura }]),
  ),
);
console.log('Pilares (nº de veces que sube / baja, suma neta):');
console.table(resumen.pilares);
console.log(`Hitos biográficos: ${resumen.hitos} · Personajes: ${resumen.personajes.length}`);

console.log(`\n== Errores (${errores.length}) ==`);
for (const e of errores) console.log(`  ✗ ${e.carta ? `[${e.carta}] ` : ''}${e.msg}`);
console.log(`\n== Avisos (${avisos.length}) ==`);
for (const a of avisos) console.log(`  · ${a.carta ? `[${a.carta}] ` : ''}${a.msg}`);

if (!process.argv.includes('--solo-validar') && !errores.length) {
  for (const estrategia of ['prudente', 'azar']) {
    const s = simular(datos, { partidas: 2000, estrategia });
    console.log(`\n== Simulación: 2000 partidas, jugador ${estrategia} ==`);
    console.log(`  Edad media ${s.edadMedia} · mediana ${s.mediana} · llegan a 100: ${s.centenarios}%`);
    console.log(`  Cartas por partida ${s.cartasPorPartida} · hitos por partida ${s.hitosPorPartida} · partidas con <4 hitos ${s.pctPocosHitos}%`);
    console.log(`  Causas: ${s.causas.map((c) => `${c.causa} ${c.pct}%`).join(' · ')}`);
    console.log(`  Edad media por rasgo: ${Object.entries(s.porRasgo).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    if (s.nuncaVistas.length) console.log(`  Nunca vistas: ${s.nuncaVistas.join(', ')}`);
  }
}
process.exit(errores.length ? 1 : 0);
