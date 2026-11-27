// Interfaz: pantallas, carta, barras y necrológica. La lógica está en engine.js.
import { cargarDatos } from './data.js';
import { Partida, construirNecrologia, evaluarDesbloqueos, draftRasgos, rasgosDisponibles, etapaDeEdad } from './engine.js';
import { cargarProgreso, guardarProgreso, registrarPartida } from './storage.js';
import { montarImagen } from './images.js';
import { aplicarGenero } from './text.js';
import { activarSwipe, lanzar, entrar, volver } from './swipe.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

let datos;
let progreso = cargarProgreso();
let partida = null;
let eleccion = {};
let marcado = null;
let ocupado = false;
let ultimoPuntero = 'mouse';
let swipe;

function mostrar(id) {
  for (const s of document.querySelectorAll('.pantalla')) s.classList.toggle('activa', s.id === id);
}

function escapar(t = '') {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// ---------- inicio y preparación ----------

function pintarInicio() {
  const p = progreso;
  $('stats-inicio').textContent = p.partidas
    ? `${p.partidas} ${p.partidas === 1 ? 'vida' : 'vidas'} · récord: ${p.record} años${p.centenarios ? ` · ${p.centenarios} centenari${p.centenarios === 1 ? 'o' : 'os'}` : ''}`
    : '';
  mostrar('pantalla-inicio');
}

function elegirSexo(valor) {
  eleccion = { sexo: valor === 'azar' ? (Math.random() < 0.5 ? 'M' : 'F') : valor };
  // Primera partida: sin elegir rasgo ni comodín, directo al año 0.
  if (progreso.partidas === 0) {
    eleccion.rasgoId = rasgosDisponibles(datos, progreso.desbloqueados)[0]?.id;
    eleccion.comodinId = datos.comodines[0]?.id;
    return empezar();
  }
  pintarRasgos();
}

function pintarRasgos() {
  const opciones = draftRasgos(datos, progreso.desbloqueados, 3);
  const total = rasgosDisponibles(datos, progreso.desbloqueados).length;
  if (opciones.length === 1) {
    eleccion.rasgoId = opciones[0].id;
    return pintarComodines();
  }
  $('ayuda-rasgo').textContent =
    total < 3 ? `Tienes ${total} de ${datos.rasgos.length} rasgos desbloqueados. Muere de formas nuevas para conseguir más.` : 'Sin repetir tirada.';
  $('lista-rasgos').replaceChildren(
    ...opciones.map((r) =>
      tarjetaEleccion(aplicarGenero(r.nombre, eleccion.sexo), [r.ventaja, r.contrapartida && `<em class="contra">${escapar(r.contrapartida)}</em>`], () => {
        eleccion.rasgoId = r.id;
        pintarComodines();
      }),
    ),
  );
  mostrar('pantalla-rasgo');
}

function pintarComodines() {
  $('lista-comodines').replaceChildren(
    ...datos.comodines.map((c) =>
      tarjetaEleccion(c.nombre, [c.descripcion], () => {
        eleccion.comodinId = c.id;
        empezar();
      }),
    ),
  );
  mostrar('pantalla-comodin');
}

function tarjetaEleccion(titulo, lineas, alElegir) {
  const b = document.createElement('button');
  b.className = 'eleccion';
  b.innerHTML = `<strong>${escapar(titulo)}</strong>${lineas
    .filter(Boolean)
    .map((l) => `<span>${l.startsWith('<em') ? l : escapar(l)}</span>`)
    .join('')}`;
  b.addEventListener('click', alElegir);
  return b;
}

// ---------- partida ----------

function empezar() {
  partida = new Partida(datos, eleccion);
  $('barras').replaceChildren(
    ...datos.config.pilares.map((p) => {
      const d = document.createElement('div');
      d.className = 'pilar';
      d.dataset.pilar = p.id;
      d.innerHTML = `<span class="punto"></span><div class="tubo"><div class="relleno"></div></div><span class="etiqueta">${escapar(p.nombre)}</span>`;
      return d;
    }),
  );
  mostrar('pantalla-juego');
  pintarBarras();
  siguiente();
}

function pintarBarras() {
  for (const el of $('barras').children) {
    const id = el.dataset.pilar;
    const v = partida.pilares[id];
    el.querySelector('.relleno').style.height = `${Math.max(0, Math.min(100, v))}%`;
    el.classList.toggle('peligro', v <= 15 || v >= 85);
    el.classList.toggle('congelado', partida.congelado?.pilar === id);
    el.title = DEBUG ? `${id}: ${v}` : '';
  }
  const y = partida.anio;
  $('edad-anio').textContent = `Año ${y}`;
  $('edad-etapa').textContent = etapaDeEdad(datos.config, Math.min(y, 99))?.nombre || '';
  pintarComodinBoton();
  if (DEBUG) {
    $('debug').hidden = false;
    $('debug').textContent = `${partida.carta?.id || '—'} · edad ${partida.edad.toFixed(2)} · ${Object.entries(partida.pilares).map(([k, v]) => `${k[0]}${v}`).join(' ')} · flags: ${[...partida.flags].join(',') || '—'}`;
  }
}

function pintarComodinBoton() {
  const b = $('btn-comodin');
  if (!partida.comodin) { b.hidden = true; return; }
  b.hidden = false;
  b.textContent = partida.comodinUsado ? `${partida.comodin.nombre} (usado)` : `Comodín: ${partida.comodin.nombre}`;
  b.disabled = !partida.puedeUsarComodin() || ocupado;
}

function siguiente() {
  const carta = partida.siguienteCarta();
  procesarEventos();
  if (!carta) return acabar();
  const t = (x) => partida.texto(x);
  $('carta-texto').textContent = t(carta.texto);
  $('carta-nombre').textContent = t(carta.nombre);
  $('op-izquierda').textContent = t(carta.izquierda.texto);
  $('op-derecha').textContent = t(carta.derecha.texto);
  $('carta-sello').hidden = true;
  montarImagen($('carta-imagen'), datos.config, carta);
  limpiarVista();
  entrar($('carta'));
  ocupado = false;
  swipe.bloquear(false);
  pintarBarras();
}

function vistaPrevia(lado) {
  if (!partida?.carta) lado = null;
  const deltas = lado ? partida.vistaPrevia(lado) : {};
  for (const el of $('barras').children) {
    const d = deltas[el.dataset.pilar] || 0;
    const punto = el.querySelector('.punto');
    const mag = Math.abs(d);
    punto.className = `punto${mag ? (mag <= 5 ? ' p1' : mag <= 12 ? ' p2' : ' p3') : ''}`;
    el.querySelector('.delta')?.remove();
    if (DEBUG && d) el.insertAdjacentHTML('beforeend', `<span class="delta">${d > 0 ? '+' : ''}${d}</span>`);
  }
  const etiqueta = $('carta-eleccion');
  if (lado) {
    etiqueta.textContent = partida.texto(partida.carta[lado].texto);
    etiqueta.className = `carta-eleccion visible ${lado}`;
  } else {
    etiqueta.className = 'carta-eleccion';
  }
  for (const l of ['izquierda', 'derecha']) $(`op-${l}`).classList.toggle('marcada', l === lado);
}

function limpiarVista() {
  marcado = null;
  vistaPrevia(null);
}

async function decidir(lado) {
  if (ocupado || !partida.carta) return;
  ocupado = true;
  swipe.bloquear(true);
  vistaPrevia(lado);
  await lanzar($('carta'), lado);
  partida.elegir(lado);
  pintarBarras();
  procesarEventos();
  if (partida.fin) return setTimeout(acabar, 350);
  siguiente();
}

function procesarEventos() {
  for (const e of partida.sacarEventos()) {
    if (e.tipo === 'periodico') {
      const partes = Object.entries(e.deltas).map(([p, v]) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${nombrePilar(p)}`);
      avisar(`${e.texto}: ${partes.join(', ')}`);
    }
    if (e.tipo === 'descongelado') avisar(`Se acabó el efecto sobre ${nombrePilar(e.pilar)}`);
  }
  pintarBarras();
}

function nombrePilar(id) {
  return datos.config.pilares.find((p) => p.id === id)?.nombre || id;
}

let temporizadorAviso;
function avisar(texto) {
  const el = $('aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (el.hidden = true), 2400);
}

// ---------- comodín ----------

function abrirComodin() {
  if (!partida.puedeUsarComodin() || ocupado) return;
  $('dlg-nombre').textContent = partida.comodin.nombre;
  $('dlg-desc').textContent = partida.comodin.descripcion;
  $('dialogo-comodin').showModal();
}

async function usarComodin() {
  $('dialogo-comodin').close();
  const r = partida.usarComodin();
  if (!r) return;
  if (r.accion === 'descartar') {
    ocupado = true;
    swipe.bloquear(true);
    limpiarVista();
    const carta = $('carta');
    carta.classList.add('saliendo');
    carta.style.transform = 'translateY(-40px) scale(0.9)';
    await new Promise((res) => setTimeout(res, 300));
    procesarEventos();
    return siguiente();
  }
  if (r.accion === 'invertir') {
    $('carta-sello').hidden = false;
    vistaPrevia(marcado);
  }
  pintarBarras();
  procesarEventos();
  if (partida.fin) setTimeout(acabar, 350);
}

// ---------- final ----------

function acabar() {
  const n = construirNecrologia(partida);
  const nuevos = evaluarDesbloqueos(datos, partida.fin, progreso.desbloqueados);
  progreso = registrarPartida(progreso, partida.fin, nuevos);
  guardarProgreso(progreso);

  const art = $('necrologica');
  art.classList.toggle('centenario', n.centenario);
  const hitos = n.hitos.length
    ? `<ul class="necro-hitos">${n.hitos.map((h) => `<li><b>Año ${h.anio}</b><span>${escapar(h.texto)}</span></li>`).join('')}</ul>`
    : '<p class="necro-vacio">Una vida sin nada digno de mención.</p>';
  art.innerHTML = `
    <p class="necro-cabecera">Necrológica</p>
    <p class="necro-cruz">${n.centenario ? '✶' : '†'}</p>
    <p class="necro-rango">${n.rango}</p>
    <p class="necro-sub">${n.sexo === 'F' ? 'Mujer' : 'Hombre'}${n.rasgo ? ` · ${escapar(n.rasgo)}` : ''}</p>
    <section class="necro-seccion"><h4>${escapar(n.titulo || 'Causa de la muerte')}</h4><p class="necro-causa">${escapar(n.texto)}</p></section>
    <section class="necro-seccion"><h4>Hitos biográficos</h4>${hitos}</section>
    ${n.remates.length ? `<section class="necro-seccion"><h4>Informe forense</h4>${n.remates.map((r) => `<p class="necro-remate">${escapar(r)}</p>`).join('')}</section>` : ''}`;
  $('desbloqueos').textContent = nuevos.length ? `Nuevo rasgo desbloqueado: ${nuevos.map((r) => aplicarGenero(r.nombre, partida.sexo)).join(', ')}` : '';
  mostrar('pantalla-necrologica');
  $('pantalla-necrologica').scrollTop = 0;
}

// ---------- arranque ----------

function conectarEventos() {
  $('btn-nueva').addEventListener('click', () => mostrar('pantalla-sexo'));
  for (const b of document.querySelectorAll('[data-sexo]')) b.addEventListener('click', () => elegirSexo(b.dataset.sexo));
  $('btn-otra').addEventListener('click', pintarInicio);
  $('btn-comodin').addEventListener('click', abrirComodin);
  $('dlg-cancelar').addEventListener('click', () => $('dialogo-comodin').close());
  $('dlg-usar').addEventListener('click', usarComodin);

  swipe = activarSwipe($('carta'), {
    alMover: (lado) => vistaPrevia(lado),
    alSoltar: (lado) => decidir(lado),
    alCancelar: () => limpiarVista(),
  });

  for (const lado of ['izquierda', 'derecha']) {
    const b = $(`op-${lado}`);
    b.addEventListener('pointerdown', (e) => (ultimoPuntero = e.pointerType));
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !ocupado) vistaPrevia(lado); });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !ocupado) vistaPrevia(marcado); });
    b.addEventListener('click', () => {
      if (ocupado) return;
      if (ultimoPuntero === 'mouse' || marcado === lado) return decidir(lado);
      marcado = lado;
      vistaPrevia(lado);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!$('pantalla-juego').classList.contains('activa') || $('dialogo-comodin').open || ocupado) return;
    const lado = { ArrowLeft: 'izquierda', ArrowRight: 'derecha', a: 'izquierda', d: 'derecha' }[e.key];
    if (lado) {
      e.preventDefault();
      if (marcado === lado) return decidir(lado);
      marcado = lado;
      vistaPrevia(lado);
    } else if (e.key === 'Escape') {
      limpiarVista();
      volver($('carta'));
    } else if (e.key === 'c') abrirComodin();
  });
}

async function arrancar() {
  try {
    datos = await cargarDatos();
  } catch (err) {
    const el = $('error-carga');
    el.hidden = false;
    el.innerHTML = `<strong>No se han podido cargar los datos.</strong>
      <span>Si has abierto el archivo con doble clic, el navegador bloquea la lectura de los .json. Ábrelo desde GitHub Pages o con un servidor local: <code>python3 -m http.server</code> y entra en <code>http://localhost:8000</code>.</span>
      <small>${escapar(err.message)}</small>`;
    return;
  }
  conectarEventos();
  pintarInicio();
}

arrancar();
