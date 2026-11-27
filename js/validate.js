// Control de calidad de los datos. Devuelve errores (rompen el juego) y avisos (revisar diseño).
import { parseRango, rangoCarta, LADOS } from './engine.js';
import { generoMalFormado, tieneGenero } from './text.js';

const LIMITE_TEXTO = 220;
const LIMITE_OPCION = 70;
const LIMITE_EFECTO = 25;

export function validar(datos) {
  const { config, cartas, rasgos, comodines, muertes } = datos;
  const errores = [];
  const avisos = [];
  const pilares = new Set(config.pilares.map((p) => p.id));
  const idsRasgo = new Set(rasgos.map((r) => r.id));
  const etapas = new Map(config.etapas.map((e) => [e.id, e]));
  const porId = new Map();
  const err = (carta, msg) => errores.push({ carta: carta?.id ?? null, archivo: carta?._archivo, msg });
  const av = (carta, msg, clase = 'diseño') => avisos.push({ carta: carta?.id ?? null, archivo: carta?._archivo, msg, clase });

  const flagsAnadidos = new Map();
  const flagsUsados = new Map();
  const encoladas = new Set();
  const anclasPorAnio = new Map();

  for (const c of cartas) {
    if (!c.id) { err(c, 'Carta sin id'); continue; }
    if (!/^[a-z0-9_]+$/.test(c.id)) err(c, `id "${c.id}" debe ser minúsculas, números y _ (se usa como nombre de imagen)`);
    if (porId.has(c.id)) err(c, `id duplicado (también en ${porId.get(c.id)._archivo})`);
    porId.set(c.id, c);

    if (!['ancla', 'etapa', 'estado'].includes(c.tipo)) err(c, `tipo "${c.tipo}" no válido (ancla | etapa | estado)`);
    if (c.tipo === 'ancla') {
      if (!Number.isInteger(c.anio) || c.anio < 0 || c.anio > config.edad_final) err(c, 'ancla sin "anio" válido');
      const k = `${c.anio}|${JSON.stringify(c.condiciones || {})}`;
      if (anclasPorAnio.has(k)) av(c, `misma ancla/año/condiciones que "${anclasPorAnio.get(k)}": saldrán las dos el mismo año`);
      anclasPorAnio.set(k, c.id);
    }
    if (c.tipo === 'etapa') {
      // "etapa" puede ser una etapa de config ("18-29") o un rango que abarque varias ("18-49").
      const libre = parseRango(c.etapa);
      const e = etapas.get(c.etapa) || (libre && libre[0] <= libre[1] && libre[1] < config.edad_final ? { desde: libre[0], hasta: libre[1] } : null);
      if (!e) err(c, `etapa "${c.etapa}" no válida (usa una de config o un rango tipo "18-49")`);
      const r = rangoCarta(c);
      if (c.edad && !parseRango(c.edad)) err(c, '"edad" debe ser [min, max]');
      if (e && r && (r[0] < e.desde || r[1] > e.hasta)) err(c, `rango de edad ${r.join('-')} fuera de la etapa ${c.etapa}`);
      if (Number.isFinite(c.edad_sugerida) && r && (c.edad_sugerida < r[0] || c.edad_sugerida > r[1])) {
        err(c, `edad_sugerida ${c.edad_sugerida} fuera de su rango ${r.join('-')}`);
      }
    }

    if (!c.nombre) err(c, 'falta "nombre"');
    if (!c.texto) err(c, 'falta "texto"');
    if (c.texto?.length > LIMITE_TEXTO) av(c, `texto largo (${c.texto.length} caracteres; en móvil caben ~${LIMITE_TEXTO})`, 'texto');
    if (!c.personaje) av(c, 'sin "personaje": solo podrá usar imagen propia', 'imagen');

    const cond = c.condiciones || {};
    if (cond.requiere_sexo && !['M', 'F'].includes(cond.requiere_sexo)) err(c, 'requiere_sexo debe ser "M" o "F"');
    for (const k of ['requiere_rasgo', 'excluye_rasgo']) {
      for (const r of cond[k] || []) if (!idsRasgo.has(r)) av(c, `${k}: el rasgo "${r}" no existe todavía`);
    }
    for (const f of cond.requiere_flags || []) flagsUsados.set(f, [...(flagsUsados.get(f) || []), c.id]);
    for (const f of cond.excluye_flags || []) flagsUsados.set(f, [...(flagsUsados.get(f) || []), c.id]);
    if (cond.prioridad && !(cond.prioridad in (config.pesos_prioridad || {}))) err(c, `prioridad "${cond.prioridad}" no definida en config`);

    for (const t of [c.texto, c.hito_biografico]) if (generoMalFormado(t)) err(c, 'marca de género mal escrita (usa {o/a})');

    const efectosLado = {};
    for (const lado of LADOS) {
      const op = c[lado];
      if (!op) { err(c, `falta la opción "${lado}"`); continue; }
      if (!op.texto) err(c, `opción ${lado} sin texto`);
      if (op.texto?.length > LIMITE_OPCION) av(c, `opción ${lado} larga (${op.texto.length} caracteres)`, 'texto');
      for (const t of [op.texto, op.hito_biografico]) if (generoMalFormado(t)) err(c, `marca de género mal escrita en ${lado}`);
      const ef = op.efectos || {};
      for (const [p, v] of Object.entries(ef)) {
        if (!pilares.has(p)) err(c, `${lado}: pilar "${p}" no existe`);
        if (typeof v !== 'number' || !Number.isFinite(v)) err(c, `${lado}: efecto de ${p} no es un número`);
        else if (Math.abs(v) > LIMITE_EFECTO) av(c, `${lado}: efecto ${p} ${v} muy fuerte (>${LIMITE_EFECTO})`);
      }
      if (!Object.values(ef).some((v) => v)) av(c, `opción ${lado} sin efectos`);
      efectosLado[lado] = ef;
      for (const f of op.add_flags || []) flagsAnadidos.set(f, [...(flagsAnadidos.get(f) || []), c.id]);
      for (const e of op.encolar || []) {
        encoladas.add(e.id);
        if (!cartas.some((x) => x.id === e.id)) err(c, `${lado}: encola "${e.id}", que no existe`);
      }
      if (op.fin && op.fin !== true && op.fin !== 'centenario') err(c, `${lado}: "fin" debe ser "centenario"`);
    }

    const [a, b] = [efectosLado.izquierda || {}, efectosLado.derecha || {}];
    const todos = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    const dif = todos.map((p) => (a[p] || 0) - (b[p] || 0));
    if (todos.length && dif.every((d) => d >= 0) && dif.some((d) => d > 0)) av(c, 'la izquierda es mejor o igual en todo: falso dilema');
    if (todos.length && dif.every((d) => d <= 0) && dif.some((d) => d < 0)) av(c, 'la derecha es mejor o igual en todo: falso dilema');
    for (const lado of LADOS) {
      const vals = Object.values(efectosLado[lado] || {}).filter(Boolean);
      if (vals.length > 1 && vals.every((v) => v > 0)) av(c, `opción ${lado}: todo ventajas`);
      if (vals.length > 1 && vals.every((v) => v < 0)) av(c, `opción ${lado}: todo castigo`);
    }
  }

  const iniciales = new Set(config.flags_iniciales || []);
  const enGrupo = new Map();
  for (const [g, lista] of Object.entries(config.grupos_flags || {})) {
    for (const f of lista) {
      if (enGrupo.has(f)) err(null, `el flag "${f}" está en dos grupos (${enGrupo.get(f)} y ${g})`);
      enGrupo.set(f, g);
    }
  }
  for (const [f, ids] of flagsUsados) {
    if (!flagsAnadidos.has(f) && !iniciales.has(f)) {
      av(null, `el flag "${f}" se exige en ${ids.join(', ')}, pero ninguna carta lo añade: esas cartas nunca salen`, 'flags');
    }
  }
  for (const [f, ids] of flagsAnadidos) {
    if (!flagsUsados.has(f)) av(null, `el flag "${f}" se añade en ${ids.join(', ')}, pero ninguna carta lo usa todavía`, 'flags');
  }
  for (const c of cartas) if (c.tipo === 'estado' && !encoladas.has(c.id)) av(c, 'carta de estado que ninguna opción encola: nunca sale');

  if (!cartas.some((c) => c.tipo === 'ancla' && c.anio === config.edad_final)) {
    av(null, `no hay carta final del año ${config.edad_final}: al llegar se pasa directo a la necrológica`, 'contenido');
  }
  for (const p of pilares) for (const ex of ['0', '100']) if (!muertes[p]?.[ex]) err(null, `falta la muerte ${p} ${ex} en deaths.json`);
  if (!muertes.centenario) err(null, 'falta la entrada "centenario" en deaths.json');
  const placeholders = JSON.stringify({ muertes, remates: datos.remates, rasgos }).match(/\[PLACEHOLDER\]/g)?.length || 0;
  if (placeholders) av(null, `${placeholders} textos [PLACEHOLDER] pendientes en muertes, remates o rasgos`, 'contenido');
  for (const r of rasgos) if (!r.desbloqueo) err(null, `rasgo ${r.id} sin "desbloqueo"`);
  if (!rasgos.some((r) => r.desbloqueo?.tipo === 'inicial')) err(null, 'no hay ningún rasgo inicial');
  if (!comodines.length) err(null, 'no hay comodines');

  return { errores, avisos, resumen: resumir(datos) };
}

export function resumir(datos) {
  const { config, cartas } = datos;
  const etapas = config.etapas.map((e) => {
    const anios = e.hasta - e.desde + 1;
    // Una carta que abarca varias etapas cuenta en la etapa donde empieza.
    const deEtapa = cartas.filter((c) => {
      const r = c.tipo === 'etapa' && rangoCarta(c);
      return r && r[0] >= e.desde && r[0] <= e.hasta;
    });
    const anclas = cartas.filter((c) => c.tipo === 'ancla' && c.anio >= e.desde && c.anio <= e.hasta);
    const sexo = (s) => deEtapa.filter((c) => (c.condiciones?.requiere_sexo || null) === s).length;
    const generales = deEtapa.filter((c) => !c.condiciones?.requiere_flags?.length && !c.condiciones?.requiere_rasgo?.length);
    const objetivo = Math.ceil(anios * config.cartas_por_anio);
    return {
      id: e.id,
      nombre: e.nombre,
      anios,
      etapa: deEtapa.length,
      anclas: anclas.length,
      ambos: sexo(null),
      soloM: sexo('M'),
      soloF: sexo('F'),
      condicionadas: deEtapa.length - generales.length,
      objetivo,
      cobertura: Math.round((Math.min(generales.length + anclas.length, objetivo) / objetivo) * 100),
    };
  });
  const pilares = {};
  for (const p of config.pilares) pilares[p.id] = { sube: 0, baja: 0, total: 0 };
  let hitos = 0;
  for (const c of cartas) {
    for (const lado of LADOS) {
      for (const [p, v] of Object.entries(c[lado]?.efectos || {})) {
        if (!pilares[p]) continue;
        if (v > 0) pilares[p].sube += 1;
        if (v < 0) pilares[p].baja += 1;
        pilares[p].total += v;
      }
      if (c[lado]?.hito_biografico) hitos += 1;
    }
    if (c.hito_biografico) hitos += 1;
  }
  const personajes = [...new Set(cartas.map((c) => c.personaje).filter(Boolean))].sort();
  return {
    total: cartas.length,
    objetivoTotal: etapas.reduce((a, e) => a + e.objetivo, 0),
    etapas,
    pilares,
    hitos,
    conGenero: cartas.filter((c) => tieneGenero(JSON.stringify(c))).length,
    personajes,
  };
}
