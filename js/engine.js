// Motor del juego. Sin DOM: se puede usar en el navegador y en Node (simulaciones, validador).
import { aplicarGenero } from './text.js';

export const LADOS = ['izquierda', 'derecha'];
const EPS = 1e-9;

// ---------- utilidades ----------

export function parseRango(valor) {
  if (Array.isArray(valor) && valor.length === 2) return [Number(valor[0]), Number(valor[1])];
  const m = String(valor ?? '').match(/^\s*(\d+)\s*[-–—]\s*(\d+)\s*$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

// Rango de edad en el que puede salir una carta de etapa.
// "edad": [60, 69] tiene prioridad sobre "etapa": "50-69".
export function rangoCarta(carta) {
  if (carta.tipo !== 'etapa') return null;
  return parseRango(carta.edad) || parseRango(carta.etapa);
}

export function etapaDeEdad(config, anio) {
  return config.etapas.find((e) => anio >= e.desde && anio <= e.hasta) || null;
}

export function cumpleCondiciones(carta, ctx) {
  const c = carta.condiciones || {};
  if (c.requiere_sexo && c.requiere_sexo !== ctx.sexo) return false;
  if (c.requiere_rasgo?.length && !c.requiere_rasgo.includes(ctx.rasgo)) return false;
  if (c.excluye_rasgo?.length && c.excluye_rasgo.includes(ctx.rasgo)) return false;
  if (c.requiere_flags?.length && !c.requiere_flags.every((f) => ctx.flags.has(f))) return false;
  if (c.excluye_flags?.length && c.excluye_flags.some((f) => ctx.flags.has(f))) return false;
  return true;
}

// Las cartas que dependen de flags o rasgo son "alta" por defecto.
export function prioridadDe(carta) {
  const c = carta.condiciones || {};
  if (c.prioridad) return c.prioridad;
  if (c.requiere_flags?.length || c.requiere_rasgo?.length) return 'alta';
  return 'normal';
}

function signoCumple(v, signo) {
  if (!v) return false;
  if (signo === 'positivo') return v > 0;
  if (signo === 'negativo') return v < 0;
  return true; // "ambos"
}

function redondear(v) {
  return Math.sign(v) * Math.round(Math.abs(v));
}

function enteroEntre(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// ---------- partida ----------

// Nivel de dificultad (config.niveles_dificultad): sus campos sobrescriben los de config.dificultad.
export function nivelesDificultad(config) {
  return config.niveles_dificultad?.niveles || [];
}

export function nivelDificultad(config, id) {
  const niveles = nivelesDificultad(config);
  const defecto = config.niveles_dificultad?.por_defecto;
  return niveles.find((n) => n.id === id) || niveles.find((n) => n.id === defecto) || null;
}

export class Partida {
  constructor(datos, { sexo = 'M', rasgoId = null, comodinId = null, nivel = null, rng = Math.random } = {}) {
    this.datos = datos;
    this.config = datos.config;
    this.rng = rng;
    this.sexo = sexo;
    this.rasgo = datos.rasgos.find((r) => r.id === rasgoId) || null;
    const n = nivelDificultad(this.config, nivel);
    this.nivel = n?.id ?? null;
    this.dif = { ...(this.config.dificultad || {}), ...(n || {}) };
    this.maxComodin = this.dif.comodines ?? 1;
    this.comodin = this.maxComodin > 0 ? datos.comodines.find((c) => c.id === comodinId) || null : null;
    this.usosComodin = 0;

    this.edad = 0;
    this.pilares = {};
    for (const p of this.config.pilares) this.pilares[p.id] = this.config.valor_inicial;
    Object.assign(this.pilares, this.rasgo?.inicio || {});

    this.flags = new Set(this.config.flags_iniciales || []);
    this.usadas = new Set();
    this.anclasDescartadas = new Set();
    this.cola = [];
    this.hitos = [];
    this.historial = [];
    this.carta = null;
    this.invertida = false;
    this.congelado = null; // { pilar, hasta }
    this.fin = null;
    this.eventos = [];
    this.porId = new Map(datos.cartas.map((c) => [c.id, c]));
    this.tiradas = new Map(); // id -> resultado de "probabilidad", tirado una vez por partida
    // Anclas alternativas: de cada "grupo" sale solo una, elegida al azar al empezar.
    const grupos = new Map();
    for (const c of datos.cartas) if (c.tipo === 'ancla' && c.grupo) grupos.set(c.grupo, [...(grupos.get(c.grupo) || []), c]);
    for (const lista of grupos.values()) {
      const elegida = lista[Math.floor(this.rng() * lista.length)];
      for (const c of lista) if (c !== elegida) this.anclasDescartadas.add(c.id);
    }
  }

  // Condiciones + probabilidad. La probabilidad se tira la primera vez que la carta podría salir.
  elegible(carta, ctx = this.ctx()) {
    if (!cumpleCondiciones(carta, ctx)) return false;
    const prob = carta.condiciones?.probabilidad;
    if (prob == null || prob >= 1) return true;
    if (!this.tiradas.has(carta.id)) this.tiradas.set(carta.id, this.rng() < prob);
    return this.tiradas.get(carta.id);
  }

  get anio() {
    return Math.floor(this.edad + EPS);
  }

  ctx() {
    return { sexo: this.sexo, rasgo: this.rasgo?.id ?? null, flags: this.flags };
  }

  // Reglas activas: las del rasgo y las de cada estado de vida (config.efectos_flags).
  reglas(tipo) {
    const porFlags = Object.entries(this.config.efectos_flags || {}).flatMap(([f, rs]) => (this.flags.has(f) && Array.isArray(rs) ? rs : []));
    return [...(this.rasgo?.reglas || []), ...porFlags].filter((r) => r.tipo === tipo);
  }

  texto(t) {
    return aplicarGenero(t, this.sexo);
  }

  // Texto de la carta: la primera variante cuyas condiciones se cumplan, o el texto normal.
  textoDe(carta) {
    const v = (carta.variantes_texto || []).find((x) => cumpleCondiciones({ condiciones: x }, this.ctx()));
    return this.texto(v?.texto ?? carta.texto);
  }

  // ---------- guardar y restaurar ----------

  exportar() {
    return {
      v: 1,
      sexo: this.sexo,
      rasgoId: this.rasgo?.id ?? null,
      comodinId: this.comodin?.id ?? null,
      nivel: this.nivel,
      usosComodin: this.usosComodin,
      edad: this.edad,
      pilares: { ...this.pilares },
      flags: [...this.flags],
      usadas: [...this.usadas],
      anclasDescartadas: [...this.anclasDescartadas],
      cola: this.cola.map((c) => ({ ...c })),
      hitos: this.hitos.map((h) => ({ ...h })),
      historial: this.historial,
      cartaId: this.carta?.id ?? null,
      invertida: this.invertida,
      congelado: this.congelado ? { ...this.congelado } : null,
      tiradas: [...this.tiradas],
    };
  }

  static restaurar(datos, e, rng = Math.random) {
    if (!e || e.v !== 1) return null;
    const p = new Partida(datos, { sexo: e.sexo, rasgoId: e.rasgoId, comodinId: e.comodinId, nivel: e.nivel ?? 'normal', rng });
    if (e.cartaId && !p.porId.has(e.cartaId)) return null; // el mazo ha cambiado: no se puede continuar
    Object.assign(p, {
      usosComodin: e.usosComodin ?? (e.comodinUsado ? 1 : 0),
      edad: e.edad,
      pilares: { ...e.pilares },
      flags: new Set(e.flags),
      usadas: new Set(e.usadas),
      anclasDescartadas: new Set(e.anclasDescartadas),
      cola: e.cola,
      hitos: e.hitos,
      historial: e.historial,
      carta: e.cartaId ? p.porId.get(e.cartaId) : null,
      invertida: e.invertida,
      congelado: e.congelado,
      tiradas: new Map(e.tiradas),
    });
    return p;
  }

  sacarEventos() {
    const e = this.eventos;
    this.eventos = [];
    return e;
  }

  // ---------- reparto de cartas ----------

  anclasPendientes(anio) {
    const ctx = this.ctx();
    const lista = [];
    for (const c of this.datos.cartas) {
      if (c.tipo !== 'ancla' || this.usadas.has(c.id) || this.anclasDescartadas.has(c.id)) continue;
      if (c.anio > anio) continue;
      // Una ancla solo sale en su año exacto: si ese año ya pasó (p. ej. partidas guardadas
      // con otra versión del mazo), se descarta en vez de salir tarde.
      if (c.anio < anio) {
        this.anclasDescartadas.add(c.id);
        continue;
      }
      if (this.elegible(c, ctx)) lista.push(c);
      else this.anclasDescartadas.add(c.id); // una ancla solo vale en su año exacto
    }
    return lista.sort((a, b) => a.anio - b.anio);
  }

  disponiblesEtapa(anio) {
    const ctx = this.ctx();
    return this.datos.cartas.filter((c) => {
      if (c.tipo !== 'etapa' || this.usadas.has(c.id)) return false;
      const r = rangoCarta(c);
      return r && anio >= r[0] && anio <= r[1] && this.elegible(c, ctx);
    });
  }

  pesoCarta(carta, anio) {
    const pesos = this.config.pesos_prioridad || { alta: 3, normal: 1 };
    let w = pesos[prioridadDe(carta)] ?? 1;
    if (Number.isFinite(carta.edad_sugerida)) {
      const d = Math.abs(anio - carta.edad_sugerida) / 2;
      w *= 1 / (1 + d * d);
    }
    const r = rangoCarta(carta);
    if (r && r[1] - anio <= 1) w *= 2; // que no se pierda si su rango se acaba
    return w;
  }

  elegirPonderada(lista, anio) {
    const pesos = lista.map((c) => this.pesoCarta(c, anio));
    let t = this.rng() * pesos.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lista.length; i++) {
      t -= pesos[i];
      if (t <= 0) return lista[i];
    }
    return lista[lista.length - 1];
  }

  ponerCarta(carta) {
    this.carta = carta;
    this.invertida = false;
    this.usadas.add(carta.id);
    return carta;
  }

  siguienteCarta() {
    this.invertida = false;
    for (let guarda = 0; guarda < 1000 && !this.fin; guarda++) {
      const y = this.anio;
      const final = this.config.edad_final;
      if (y >= final) {
        const ultima = this.anclasPendientes(final).find((c) => c.anio === final);
        if (ultima) return this.ponerCarta(ultima);
        this.terminar({ tipo: 'centenario' });
        return null;
      }
      const ancla = this.anclasPendientes(y)[0];
      if (ancla) return this.ponerCarta(ancla);

      this.cola.sort((a, b) => a.anio - b.anio);
      while (this.cola.length && this.cola[0].anio <= y) {
        const c = this.porId.get(this.cola.shift().id);
        if (c && !this.usadas.has(c.id) && this.elegible(c)) return this.ponerCarta(c);
      }

      const pool = this.disponiblesEtapa(y);
      if (pool.length) return this.ponerCarta(this.elegirPonderada(pool, y));

      this.avanzarHasta(this.proximaOportunidad(y));
    }
    return null;
  }

  // Primer año futuro en el que podría salir algo.
  proximaOportunidad(y) {
    const ctx = this.ctx();
    let min = this.config.edad_final;
    for (const c of this.datos.cartas) {
      if (this.usadas.has(c.id)) continue;
      if (c.tipo === 'ancla' && !this.anclasDescartadas.has(c.id) && c.anio > y) min = Math.min(min, c.anio);
      if (c.tipo === 'etapa' && this.elegible(c, ctx)) {
        const r = rangoCarta(c);
        if (r && r[0] > y) min = Math.min(min, r[0]);
      }
    }
    for (const item of this.cola) if (item.anio > y) min = Math.min(min, item.anio);
    return Math.max(min, y + 1);
  }

  // Cuánto avanza la edad tras una carta: depende de cuántas cartas quedan en la etapa.
  // Con muchas cartas, ~cartas_por_anio; con pocas, se saltan años.
  calcularPaso() {
    const y = this.anio;
    const etapa = etapaDeEdad(this.config, y);
    if (!etapa) return 1;
    const restantes = etapa.hasta + 1 - this.edad;
    const ctx = this.ctx();
    let k = 0;
    for (const c of this.datos.cartas) {
      if (c.tipo !== 'etapa' || this.usadas.has(c.id) || !this.elegible(c, ctx)) continue;
      const r = rangoCarta(c);
      if (r && r[1] >= y && r[0] <= etapa.hasta) k++;
    }
    const deseadas = Math.min(k, restantes * this.config.cartas_por_anio);
    if (deseadas < 1) return restantes;
    // Con 1 carta por año (o menos), la edad avanza en años enteros: cada decisión es un año.
    if (this.config.cartas_por_anio <= 1) return Math.max(1, Math.round(restantes / deseadas));
    return (restantes / deseadas) * (0.8 + this.rng() * 0.4);
  }

  // Años (a, b] donde hay un ancla o una consecuencia programada: la edad se detiene ahí.
  primerEventoEntre(a, b) {
    const ctx = this.ctx();
    let min = null;
    const ver = (anio) => {
      if (anio > a && anio <= b && (min === null || anio < min)) min = anio;
    };
    for (const c of this.datos.cartas) {
      if (c.tipo === 'ancla' && !this.usadas.has(c.id) && !this.anclasDescartadas.has(c.id) && this.elegible(c, ctx)) ver(c.anio);
    }
    for (const item of this.cola) ver(item.anio);
    return min;
  }

  avanzar() {
    const antes = this.anio;
    let nueva = this.edad + this.calcularPaso();
    const corte = this.primerEventoEntre(antes, Math.floor(nueva + EPS));
    if (corte !== null) nueva = corte;
    // Una consecuencia que debía salir este año (pero le ganó un ancla) no espera al salto completo.
    if (this.cola.some((item) => item.anio <= antes)) nueva = Math.min(nueva, antes + 1);
    this.avanzarHasta(nueva);
  }

  avanzarHasta(nueva) {
    const antes = this.anio;
    this.edad = Math.min(nueva, this.config.edad_final);
    const despues = this.anio;
    for (const regla of this.reglas('periodico')) {
      const cada = regla.cada_anios;
      for (let a = (Math.floor(antes / cada) + 1) * cada; a <= despues; a += cada) {
        if (this.fin) return;
        const deltas = this.aplicarDeltas(regla.efectos);
        this.eventos.push({ tipo: 'periodico', anio: a, texto: regla.mensaje || this.rasgo.nombre, deltas });
        this.comprobarMuerte();
      }
    }
    if (this.congelado && this.edad + EPS >= this.congelado.hasta) {
      this.eventos.push({ tipo: 'descongelado', pilar: this.congelado.pilar });
      this.congelado = null;
    }
  }

  // ---------- efectos ----------

  // Devuelve los cambios reales (tras rasgo, inversión y congelación) sin aplicarlos.
  calcularEfectos(efectos = {}, invertir = this.invertida) {
    const base = {};
    for (const [p, v] of Object.entries(efectos)) base[p] = invertir ? -v : v;

    for (const r of this.reglas('anula')) {
      if (signoCumple(base[r.si.pilar], r.si.signo) && signoCumple(base[r.anula.pilar], r.anula.signo)) {
        base[r.anula.pilar] = 0;
      }
    }
    const tags = this.carta?.tags || [];
    for (const r of this.reglas('multiplicador')) {
      if (r.tags?.length && !r.tags.some((t) => tags.includes(t))) continue;
      for (const p of Object.keys(base)) {
        if ((r.pilar === p || r.pilar === '*') && signoCumple(base[p], r.signo)) base[p] *= r.mult;
      }
    }
    // "Cuando una decisión baja X, sube Y": se suma después de los multiplicadores.
    for (const r of this.reglas('transferencia')) {
      if (signoCumple(base[r.si.pilar], r.si.signo)) {
        for (const [p, v] of Object.entries(r.efectos)) base[p] = (base[p] || 0) + v;
      }
    }
    // Dificultad global (config.dificultad): volatilidad para todo y castigo extra a partir de cierta edad.
    const dif = this.dif;
    const castigo = dif.castigo_edad && this.anio >= dif.castigo_edad.desde ? dif.castigo_edad.mult : 1;
    const volatilidad = this.anio >= (dif.volatilidad_desde ?? 0) ? dif.volatilidad ?? 1 : 1;
    for (const p of Object.keys(base)) {
      base[p] *= volatilidad;
      if (base[p] < 0) base[p] *= castigo;
    }
    const out = {};
    for (const [p, v] of Object.entries(base)) {
      let d = redondear(v);
      if (this.congelado && this.congelado.pilar === p) d = 0;
      if (d !== 0) out[p] = d;
    }
    return out;
  }

  vistaPrevia(lado) {
    if (!this.carta) return {};
    return this.calcularEfectos(this.carta[lado]?.efectos);
  }

  aplicarDeltas(deltas) {
    const aplicados = {};
    for (const [p, v] of Object.entries(deltas)) {
      if (!(p in this.pilares)) continue;
      if (this.congelado && this.congelado.pilar === p) continue;
      this.pilares[p] += v;
      aplicados[p] = v;
    }
    return aplicados;
  }

  comprobarMuerte() {
    if (this.fin) return;
    let peor = null;
    for (const p of this.config.pilares) {
      const v = this.pilares[p.id];
      let cand = null;
      if (v <= 0) cand = { pilar: p.id, extremo: 0, exceso: -v };
      else if (v >= 100) cand = { pilar: p.id, extremo: 100, exceso: v - 100 };
      if (cand && (!peor || cand.exceso > peor.exceso)) peor = cand;
    }
    if (peor) this.terminar({ tipo: 'muerte', pilar: peor.pilar, extremo: peor.extremo });
  }

  terminar(causa) {
    if (this.fin) return;
    this.fin = { causa, anio: this.anio, pilares: { ...this.pilares } };
    this.carta = null;
  }

  elegir(lado) {
    const carta = this.carta;
    if (!carta || this.fin) return null;
    const op = carta[lado] || {};
    // Sorpresa: con cierta probabilidad la opción sale de otra manera (otros efectos y, si los define, otros flags).
    const probSorpresa = this.dif.sorpresas ?? op.sorpresa?.probabilidad;
    const sorpresa = op.sorpresa && this.rng() < probSorpresa ? op.sorpresa : null;
    const efectos = sorpresa ? sorpresa.efectos : op.efectos;
    const quitar = sorpresa?.remove_flags ?? op.remove_flags;
    const deltas = this.aplicarDeltas(this.calcularEfectos(efectos));

    for (const f of quitar || []) this.flags.delete(f);
    const anadir = [...(sorpresa?.add_flags ?? op.add_flags ?? []), ...(op.add_flags_por_sexo?.[this.sexo] || [])];
    for (const f of anadir) {
      // Flags de un mismo grupo son excluyentes: al añadir uno se quitan los demás.
      for (const grupo of Object.values(this.config.grupos_flags || {})) {
        if (grupo.includes(f)) for (const otro of grupo) this.flags.delete(otro);
      }
      this.flags.add(f);
    }

    for (const e of op.encolar || []) {
      const [min, max] = Array.isArray(e.en_anios) ? e.en_anios : [e.en_anios ?? 1, e.en_anios ?? 1];
      this.cola.push({ id: e.id, anio: this.anio + enteroEntre(this.rng, min, max) });
    }

    const anio = this.anio;
    for (const fuente of [carta, op]) {
      if (fuente.hito_biografico) {
        this.hitos.push({ anio, texto: this.texto(fuente.hito_biografico), carta: carta.id });
      }
    }
    this.historial.push({ id: carta.id, lado, anio, deltas, invertida: this.invertida, sorpresa: !!sorpresa });
    this.carta = null;
    this.invertida = false;

    this.comprobarMuerte();
    if (!this.fin && op.fin) {
      this.terminar({ tipo: op.fin === true ? 'centenario' : op.fin, texto: op.fin_texto, titulo: op.fin_titulo, rango: op.fin_rango, final: op.fin_id });
      if (Number.isFinite(op.fin_anio)) this.fin.anio = op.fin_anio;
    }
    if (!this.fin) this.avanzar();
    // La consecuencia narra un cambio de vida (flags). No sale si la sorpresa trae sus propios flags.
    const consecuencia = op.consecuencia && !sorpresa?.add_flags ? this.texto(op.consecuencia) : null;
    return { deltas, sorpresa: sorpresa ? this.texto(sorpresa.mensaje) : null, consecuencia };
  }

  // ---------- comodín ----------

  get comodinUsado() {
    return this.usosComodin >= this.maxComodin;
  }

  get comodinesRestantes() {
    return this.comodin ? Math.max(0, this.maxComodin - this.usosComodin) : 0;
  }

  puedeUsarComodin() {
    return !!(this.comodin && !this.comodinUsado && !this.fin && this.carta);
  }

  usarComodin() {
    if (!this.puedeUsarComodin()) return null;
    const { accion, parametros = {} } = this.comodin;
    this.usosComodin++;
    switch (accion) {
      case 'descartar': {
        this.historial.push({ id: this.carta.id, lado: null, anio: this.anio, deltas: {}, comodin: this.comodin.id });
        this.carta = null;
        this.avanzar();
        return { accion };
      }
      case 'invertir':
        this.invertida = true;
        return { accion };
      case 'congelar': {
        const { pilar, valor, anios } = parametros;
        this.pilares[pilar] = valor;
        this.congelado = { pilar, hasta: this.edad + anios };
        return { accion };
      }
      case 'equilibrar': {
        // La barra más cerca de un extremo vuelve hacia el centro.
        const cantidad = parametros.cantidad ?? 25;
        const [pilar, valor] = Object.entries(this.pilares).sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50))[0];
        const deltas = this.aplicarDeltas({ [pilar]: Math.sign(50 - valor) * Math.min(cantidad, Math.abs(50 - valor)) });
        return { accion, deltas };
      }
      case 'efecto_directo': {
        const deltas = this.aplicarDeltas(parametros.efectos || {});
        this.comprobarMuerte();
        return { accion, deltas };
      }
      default:
        this.usosComodin--;
        return null;
    }
  }
}

// ---------- final de partida ----------

function seleccionarHitos(hitos, max) {
  if (hitos.length <= max) return [...hitos];
  // Repartidos a lo largo de la vida: el primero, el último y los de en medio a intervalos regulares.
  return Array.from({ length: max }, (_, i) => hitos[Math.round((i * (hitos.length - 1)) / Math.max(1, max - 1))]);
}

export function construirNecrologia(partida) {
  const { datos, fin, sexo } = partida;
  const { causa, anio, pilares } = fin;
  let entrada;
  if (causa.tipo === 'muerte') entrada = datos.muertes[causa.pilar]?.[String(causa.extremo)];
  else entrada = datos.muertes[causa.tipo];
  entrada = entrada || { titulo: 'Causa desconocida', texto: '' };
  const variante = (entrada.variantes || []).find((v) => anio <= (v.edad_max ?? Infinity) && anio >= (v.edad_min ?? 0));
  let relato = entrada;
  if (causa.tipo === 'muerte' && !variante && causa.texto == null && causa.titulo == null) {
    const alternativas = (entrada.alternativas || []).filter(
      (a) => anio >= (a.edad_min ?? 0) && anio <= (a.edad_max ?? Infinity),
    );
    if (alternativas.length) {
      const relatos = [entrada, ...alternativas];
      relato = relatos[Math.floor(partida.rng() * relatos.length)];
    }
  }
  const textoCausa = causa.texto ?? variante?.texto ?? relato.texto;

  // Remates: todos los condicionales que encajen (en el orden del archivo) + uno aleatorio.
  const R = datos.remates || {};
  const encajan = (R.condicionales || []).filter((r) => {
    if (r.causa && r.causa !== causa.tipo) return false;
    if (r.final && r.final !== causa.final) return false; // remate exclusivo de un final concreto
    if (r.pilar) {
      const v = pilares[r.pilar];
      if (v < (r.min ?? -Infinity) || v > (r.max ?? Infinity)) return false;
    }
    return anio >= (r.edad_min ?? -Infinity) && anio <= (r.edad_max ?? Infinity);
  });
  // Aleatorios: textos sueltos o { texto, causa } para limitarlos a un tipo de final.
  const posibles = (R.aleatorios || []).filter((r) => typeof r === 'string' || !r.causa || r.causa === causa.tipo);
  const azar = posibles.length ? [posibles[Math.floor(partida.rng() * posibles.length)]] : [];
  const remates = [...encajan.map((r) => r.texto), ...azar.map((r) => (typeof r === 'string' ? r : r.texto))];

  return {
    edad: anio,
    rango: causa.rango ? aplicarGenero(causa.rango, sexo) : `${anio} ${anio === 1 ? "año" : "años"}`,
    // Si llegas a los 100 no hay necrológica: hay fe de vida.
    cabecera: causa.tipo === 'centenario' ? 'Fe de vida' : 'Necrológica',
    tituloInforme: causa.tipo === 'centenario' ? 'Informe de la Seguridad Social' : 'Informe forense',
    sexo,
    centenario: causa.tipo === 'centenario',
    causa,
    titulo: aplicarGenero(causa.titulo || relato.titulo || '', sexo),
    texto: aplicarGenero(textoCausa || '', sexo),
    hitos: seleccionarHitos(partida.hitos, datos.config.hitos_max ?? 6),
    remates: remates.map((t) => aplicarGenero(t, sexo)),
    // Qué barra mató y en qué extremo: «Paz mental: 100».
    barra: causa.tipo === 'muerte' ? `${datos.config.pilares.find((p) => p.id === causa.pilar)?.nombre ?? causa.pilar}: ${causa.extremo}` : null,
    rasgo: partida.rasgo ? aplicarGenero(partida.rasgo.nombre, sexo) : null,
    pilares,
  };
}

// ¿Cumple este final la condición de desbloqueo?
// tipos: inicial | muerte (pilar y extremo opcionales) | centenario | edad (min: edad alcanzada)
export function cumpleDesbloqueo(d, fin) {
  if (!d || d.tipo === 'inicial') return false;
  const c = fin.causa;
  if (d.tipo === 'muerte') {
    return c.tipo === 'muerte' && (d.pilar == null || c.pilar === d.pilar) && (d.extremo == null || c.extremo === d.extremo);
  }
  if (d.tipo === 'centenario') return c.tipo === 'centenario';
  if (d.tipo === 'edad') return fin.anio >= d.min;
  return false;
}

// Rasgos y comodines nuevos que desbloquea este final. Cada uno lleva _clase: 'rasgo' | 'comodin'.
export function evaluarDesbloqueos(datos, fin, desbloqueados) {
  const ya = new Set(desbloqueados);
  return [
    ...datos.rasgos.map((r) => ({ ...r, _clase: 'rasgo' })),
    ...datos.comodines.map((c) => ({ ...c, _clase: 'comodin' })),
  ].filter((x) => !ya.has(x.id) && cumpleDesbloqueo(x.desbloqueo, fin));
}

export function comodinesDisponibles(datos, desbloqueados) {
  const ya = new Set(desbloqueados);
  return datos.comodines.filter((c) => !c.desbloqueo || c.desbloqueo.tipo === 'inicial' || ya.has(c.id));
}

export function rasgosDisponibles(datos, desbloqueados) {
  const ya = new Set(desbloqueados);
  return datos.rasgos.filter((r) => r.desbloqueo?.tipo === 'inicial' || ya.has(r.id));
}

export function draftRasgos(datos, desbloqueados, n = 3, rng = Math.random) {
  const lista = [...rasgosDisponibles(datos, desbloqueados)];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista.slice(0, n);
}
