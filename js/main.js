// Interfaz: pantallas, carta, barras y necrológica. La lógica está en engine.js.
import { prepararAudio, reproducirEfecto } from './audio.js';
import { cargarDatos } from './data.js';
import { Partida, construirNecrologia, evaluarDesbloqueos, rasgosDisponibles, comodinesDisponibles, etapaDeEdad, nivelesDificultad, nivelDificultad } from './engine.js';
import { cargarProgreso, guardarProgreso, registrarPartida, guardarPartida, cargarPartida, borrarPartida, cargarNivel, guardarNivel } from './storage.js';
import { montarImagen } from './images.js';
import { aplicarGenero } from './text.js';
import { icono } from './iconos.js';
import { activarSwipe, lanzar, entrar, volver } from './swipe.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

let datos;
let progreso = cargarProgreso();
let partida = null;
let eleccion = {};
let marcado = null;
let ocupado = false;
let swipe;

function mostrar(id) {
  for (const s of document.querySelectorAll('.pantalla')) s.classList.toggle('activa', s.id === id);
}

function escapar(t = '') {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// ---------- inicio y preparación ----------

// Portada: una ilustración de carta al azar (de las que existen según assets/cards/indice.json).
let ilustraciones = [];
async function cargarIlustraciones() {
  try {
    const r = await fetch('assets/cards/indice.json', { cache: 'no-cache' });
    if (r.ok) ilustraciones = (await r.json()).ilustraciones || [];
  } catch {
    /* sin índice: portada sin ilustración */
  }
}

function pintarPortada() {
  const marco = $('portada-arte');
  if (!ilustraciones.length) { marco.replaceChildren(); return; }
  const id = ilustraciones[Math.floor(Math.random() * ilustraciones.length)];
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.src = datos.config.imagenes.cartas.replace('{id}', id);
  marco.replaceChildren(img);
}

const SUBTITULOS_INICIO = [
  'Polvo eres',
  'La vida que nadie pidió',
  'Solo de ida',
  'No se admiten devoluciones',
  'Un parpadeo entre dos nadas',
  'Ya queda menos',
  'Un trámite biológico',
  'Todo acabará pronto',
  'Sin punto de guardado',
  'Breve e innecesaria',
  'Un lunes tras otro',
  'Con fecha de caducidad',
  'Todo es provisional',
  'Un día más, un día menos',
  'El tiempo pasa igual',
  'Un paréntesis incómodo',
  'Puro relleno cósmico',
  'Materia prestada',
  'Accidente termodinámico',
  'Un suspiro en el vacío',
];

function pintarInicio() {
  pintarPortada();
  const p = progreso;
  const guardada = cargarPartida();
  $('btn-continuar').hidden = !guardada;
  $('btn-nueva').classList.toggle('primario', !guardada);
  if (guardada) $('btn-continuar').textContent = `Continuar · Año ${Math.floor(guardada.edad)}`;
  $('stats-inicio').textContent = p.partidas
    ? `${p.partidas} ${p.partidas === 1 ? 'vida' : 'vidas'} · récord: ${p.record} años${p.centenarios ? ` · ${p.centenarios} centenari${p.centenarios === 1 ? 'o' : 'os'}` : ''}`
    : '';
  mostrar('pantalla-inicio');
}

function nivelActual() {
  return nivelDificultad(datos.config, cargarNivel());
}

// Nadie elige cómo nace: sexo, rasgo y comodín salen al azar entre lo desbloqueado.
function nacer() {
  const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
  eleccion = {
    sexo: Math.random() < 0.5 ? 'M' : 'F',
    nivel: nivelActual()?.id,
    rasgoId: azar(rasgosDisponibles(datos, progreso.desbloqueados))?.id,
    comodinId: azar(comodinesDisponibles(datos, progreso.desbloqueados))?.id,
  };
  empezar();
}

// ---------- partida ----------

function empezar() {
  desbloqueadosEnPartida = [];
  partida = new Partida(datos, eleccion);
  montarJuego();
  siguiente();
  revelarNacimiento();
}

function continuar() {
  partida = Partida.restaurar(datos, cargarPartida());
  if (!partida) {
    borrarPartida();
    return pintarInicio();
  }
  montarJuego();
  if (partida.carta) mostrarCarta(partida.carta);
  else siguiente();
}

function montarJuego() {
  $('barras').replaceChildren(
    ...datos.config.pilares.map((p) => {
      const d = document.createElement('div');
      d.className = 'pilar';
      d.dataset.pilar = p.id;
      d.title = p.nombre;
      d.setAttribute('aria-label', p.nombre);
      d.tabIndex = 0;
      d.addEventListener('click', () => mostrarNombrePilar(d));
      d.innerHTML = `<span class="nombre-pilar" aria-hidden="true">${escapar(p.nombre)}</span><span class="punto"></span><div class="tubo"><div class="relleno"></div></div><span class="etiqueta">${icono(p.icono || p.id)}</span>`;
      return d;
    }),
  );
  // Modo dios: las barras no muestran su nivel.
  $('barras').classList.toggle('ocultas', !!partida.dif.barras_ocultas);
  mostrar('pantalla-juego');
  pintarBarras();
}

// Al tocar una barra aparece su nombre encima, un momento.
function mostrarNombrePilar(el) {
  for (const otro of $('barras').children) if (otro !== el) otro.classList.remove('nombrando');
  el.classList.add('nombrando');
  clearTimeout(el._temporizador);
  el._temporizador = setTimeout(() => el.classList.remove('nombrando'), 1500);
}

function guardar() {
  if (partida && !partida.fin) guardarPartida(partida.exportar());
}

function pintarBarras({ conEdad = true } = {}) {
  for (const el of $('barras').children) {
    const id = el.dataset.pilar;
    const v = partida.pilares[id];
    el.querySelector('.relleno').style.height = `${Math.max(0, Math.min(100, v))}%`;
    el.classList.toggle('peligro', v <= 15 || v >= 85);
    el.classList.toggle('congelado', partida.congelado?.pilar === id);
    el.title = DEBUG ? `${el.getAttribute('aria-label')}: ${v}` : el.getAttribute('aria-label');
  }
  const y = partida.anio;
  // Mientras se lee el dorso, la cabecera sigue siendo la de la carta decidida.
  if (conEdad) {
    $('edad-anio').textContent = `Año ${y}`;
    $('edad-etapa').textContent = etapaDeEdad(datos.config, Math.min(y, 99))?.nombre || '';
  }
  pintarComodinBoton();
  if (DEBUG) {
    $('debug').hidden = false;
    $('debug').textContent = `${partida.carta?.id || '—'} · edad ${partida.edad.toFixed(2)} · ${Object.entries(partida.pilares).map(([k, v]) => `${k[0]}${v}`).join(' ')} · flags: ${[...partida.flags].join(',') || '—'}`;
  }
}

function pintarComodinBoton() {
  const b = $('btn-comodin');
  // Sin comodín el hueco se mantiene, para que Ajustes no se mueva.
  b.style.visibility = partida.comodin ? '' : 'hidden';
  if (!partida.comodin) return;
  const restantes = partida.comodinesRestantes;
  // Con varios usos (Fácil) se ve cuántos quedan.
  b.innerHTML = icono(partida.comodin.icono) + (partida.maxComodin > 1 && restantes ? `<span class="usos">${restantes}</span>` : '');
  const nombre = partida.comodinUsado
    ? `${partida.comodin.nombre} (usado)`
    : `Comodín: ${partida.comodin.nombre}${partida.maxComodin > 1 ? ` (quedan ${restantes})` : ''}`;
  b.setAttribute('aria-label', nombre);
  b.title = nombre;
  b.classList.toggle('usado', partida.comodinUsado);
  b.disabled = !partida.puedeUsarComodin() || ocupado;
}

function siguiente() {
  const carta = partida.siguienteCarta();
  procesarEventos();
  if (!carta) return acabar();
  mostrarCarta(carta);
}

function mostrarCarta(carta) {
  guardar();
  const t = (x) => partida.texto(x);
  $('carta-texto').textContent = partida.textoDe(carta);
  $('carta-nombre').textContent = t(carta.nombre);
  // Pista del gesto solo en las primeras cartas de la primera partida.
  $('pista').hidden = !(progreso.partidas === 0 && partida.historial.length < 3);
  $('carta-sello').hidden = !partida.invertida;
  $('carta-dorso').hidden = true;
  montarImagen($('carta-imagen'), datos.config, carta);
  limpiarVista();
  entrar($('carta'));
  ocupado = false;
  swipe.bloquear(false);
  pintarBarras();
}

function vistaPrevia(lado) {
  if (!partida?.carta) lado = null;
  // Con vista_previa_barras = false (todos los niveles menos Fácil) no hay puntos: solo el texto de la opción.
  const conPuntos = partida?.dif.vista_previa_barras !== false;
  const deltas = lado && conPuntos ? partida.vistaPrevia(lado) : {};
  for (const el of $('barras').children) {
    const d = deltas[el.dataset.pilar] || 0;
    const punto = el.querySelector('.punto');
    const mag = Math.abs(d);
    // Con dificultad.puntos_por_magnitud = false, todos los puntos son iguales: sabes qué barra cambia, no cuánto.
    const tamano = partida.dif.puntos_por_magnitud === false ? ' p2' : mag <= 5 ? ' p1' : mag <= 12 ? ' p2' : ' p3';
    punto.className = `punto${mag ? tamano : ''}`;
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
  reproducirEfecto('carta');
  const resultado = partida.elegir(lado);
  anunciarDesbloqueosPorEdad();
  const mensajes = [resultado?.sorpresa, resultado?.consecuencia].filter(Boolean);
  if (mensajes.length) {
    // La carta vuelve al centro y se da la vuelta: el mensaje está en su dorso.
    limpiarVista();
    volver($('carta'));
    await esperar(220);
    pintarBarras({ conEdad: false });
    for (const m of mensajes) await leerDorso(m);
  }
  await lanzar($('carta'), lado);
  pintarBarras();
  procesarEventos();
  if (partida.fin) return setTimeout(acabar, 350);
  siguiente();
}

// Comodines que se ganan al cumplir cierta edad: se anuncian en el momento y se guardan ya,
// aunque la partida no llegue a terminarse.
let desbloqueadosEnPartida = [];
function anunciarDesbloqueosPorEdad() {
  const nuevos = evaluarDesbloqueos(datos, { anio: partida.anio, causa: { tipo: 'en_curso' } }, progreso.desbloqueados);
  if (!nuevos.length) return;
  progreso = { ...progreso, desbloqueados: [...progreso.desbloqueados, ...nuevos.map((x) => x.id)] };
  guardarProgreso(progreso);
  desbloqueadosEnPartida.push(...nuevos);
  for (const x of nuevos) avisar(`${x._clase === 'rasgo' ? 'Rasgo' : 'Comodín'} desbloqueado: ${aplicarGenero(x.nombre, partida.sexo)}`, 3200);
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

// Avisos en cola: uno detrás de otro, sin pisarse.
const colaAvisos = [];
let avisoEnCurso = false;
function avisar(texto, ms = 2400) {
  colaAvisos.push({ texto, ms });
  if (!avisoEnCurso) siguienteAviso();
}

function siguienteAviso() {
  const el = $('aviso');
  const aviso = colaAvisos.shift();
  avisoEnCurso = !!aviso;
  if (!aviso) return (el.hidden = true);
  el.hidden = true;
  void el.offsetWidth; // reinicia la animación de entrada
  el.textContent = aviso.texto;
  el.hidden = false;
  setTimeout(siguienteAviso, aviso.ms);
}

// Se cierra al tocar la pantalla o pulsar una tecla, o sola a los 3,5 s.
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Media vuelta hasta el canto, se cambia la cara y termina el giro.
async function girarCarta(alDorso, texto) {
  const carta = $('carta');
  carta.classList.add('girando');
  carta.style.transform = 'rotateY(90deg)';
  await esperar(160);
  $('carta-dorso').textContent = texto || '';
  $('carta-dorso').hidden = !alDorso;
  carta.style.transform = 'rotateY(0deg)';
  await esperar(160);
  carta.classList.remove('girando');
}

// Se cierra al tocar la pantalla o pulsar una tecla, o sola a los 4 s.
async function leerDorso(texto) {
  await girarCarta(true, texto);
  await esperarToque();
}

// Se sigue al tocar la pantalla o pulsar una tecla, o solo a los 4 s.
function esperarToque(ms = 4000) {
  return new Promise((resolver) => {
    const cerrar = () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', cerrar, true);
      document.removeEventListener('keydown', cerrar, true);
      resolver();
    };
    const t = setTimeout(cerrar, ms);
    setTimeout(() => {
      document.addEventListener('pointerdown', cerrar, true);
      document.addEventListener('keydown', cerrar, true);
    }, 300);
  });
}

// La primera carta llega boca abajo: por detrás, con qué has nacido.
async function revelarNacimiento() {
  ocupado = true;
  swipe.bloquear(true);
  const dorso = $('carta-dorso');
  const rasgo = partida.rasgo ? aplicarGenero(partida.rasgo.nombre, partida.sexo) : '';
  dorso.innerHTML = `<span class="dorso-nacimiento"><b>${partida.sexo === 'F' ? 'Mujer' : 'Hombre'}</b>${rasgo ? `<span>${escapar(rasgo)}</span>` : ''}</span>`;
  dorso.hidden = false;
  $('carta-texto').style.visibility = 'hidden';
  await esperarToque();
  await girarCarta(false);
  $('carta-texto').style.visibility = '';
  ocupado = false;
  swipe.bloquear(false);
}

// ---------- comodín ----------

function abrirComodin() {
  if (!partida.puedeUsarComodin() || ocupado) return;
  $('dlg-icono').innerHTML = icono(partida.comodin.icono);
  $('dlg-nombre').textContent = partida.comodin.nombre;
  $('dlg-desc').textContent = partida.comodin.descripcion;
  $('dialogo-comodin').showModal();
}

async function usarComodin() {
  $('dialogo-comodin').close();
  const r = partida.usarComodin();
  if (!r) return;
  reproducirEfecto('comodin');
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
  guardar();
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
  reproducirEfecto('cierre');
  borrarPartida();
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
    <p class="necro-cabecera">${escapar(n.cabecera)}</p>
    <p class="necro-cruz">${n.centenario ? '✶' : '†'}</p>
    <p class="necro-rango">${n.rango}</p>
    <p class="necro-sub">${n.sexo === 'F' ? 'Mujer' : 'Hombre'}${n.rasgo ? ` · ${escapar(n.rasgo)}` : ''}${partida.nivel && partida.nivel !== 'normal' ? ` · ${escapar(nivelDificultad(datos.config, partida.nivel).nombre)}` : ''}</p>
    <section class="necro-seccion"><h4>${escapar(n.titulo || 'Causa de la muerte')}</h4><p class="necro-causa">${escapar(n.texto)}</p></section>
    <section class="necro-seccion"><h4>Hitos biográficos</h4>${hitos}</section>`;
  // Desbloqueos de esta vida: los de edad se anunciaron durante la partida; aquí van todos juntos.
  const todos = [...desbloqueadosEnPartida, ...nuevos];
  const nombres = (clase) => todos.filter((x) => x._clase === clase).map((x) => aplicarGenero(x.nombre, partida.sexo)).join(', ');
  $('desbloqueos').textContent = [
    nombres('rasgo') && `Nuevo rasgo desbloqueado: ${nombres('rasgo')}`,
    nombres('comodin') && `Nuevo comodín desbloqueado: ${nombres('comodin')}`,
  ].filter(Boolean).join(' · ');
  mostrar('pantalla-necrologica');
  $('pantalla-necrologica').scrollTop = 0;
}

// ---------- dificultad (Ajustes) ----------

function pintarSelectorNivel() {
  const niveles = nivelesDificultad(datos.config);
  const actual = nivelActual()?.id;
  $('niveles').replaceChildren(
    ...niveles.map((n) => {
      const op = document.createElement('label');
      op.className = 'nivel';
      op.innerHTML = `<input type="radio" name="nivel" value="${n.id}"${n.id === actual ? ' checked' : ''}>
        <span class="casilla" aria-hidden="true"></span><span class="nivel-nombre">${escapar(n.nombre)}</span>`;
      op.querySelector('input').addEventListener('change', () => {
        guardarNivel(n.id);
        reproducirEfecto('boton');
        describirNivel();
      });
      return op;
    }),
  );
  describirNivel();
}

function describirNivel() {
  const n = nivelActual();
  // Una partida en curso conserva su nivel; el cambio vale para la siguiente.
  const enCurso = partida && !partida.fin && partida.nivel !== n?.id && $('pantalla-juego').classList.contains('activa');
  $('nivel-nota').hidden = !enCurso;
}

// ---------- arranque ----------

function conectarEventos() {
  for (const b of document.querySelectorAll('.icono-btn.ajustes, .portada-ajustes')) b.innerHTML = icono('ajustes');
  pintarSelectorNivel();
  for (const b of document.querySelectorAll('[data-ajustes]')) b.addEventListener('click', describirNivel);
  prepararAudio();
  $('btn-nueva').addEventListener('click', nacer);
  $('btn-continuar').addEventListener('click', continuar);
  $('btn-otra').addEventListener('click', pintarInicio);
  $('btn-comodin').addEventListener('click', abrirComodin);
  $('dlg-cancelar').addEventListener('click', () => $('dialogo-comodin').close());
  $('dlg-usar').addEventListener('click', usarComodin);

  swipe = activarSwipe($('carta'), {
    alMover: (lado) => vistaPrevia(lado),
    alSoltar: (lado) => decidir(lado),
    alCancelar: () => limpiarVista(),
  });

  document.addEventListener('keydown', (e) => {
    if (!$('pantalla-juego').classList.contains('activa') || document.querySelector('dialog[open]') || ocupado) return;
    const lado = { ArrowLeft: 'izquierda', ArrowRight: 'derecha', a: 'izquierda', d: 'derecha' }[e.key];
    if (lado) {
      e.preventDefault();
      if (marcado === lado) return decidir(lado);
      marcado = lado;
      vistaPrevia(lado);
      const x = lado === 'izquierda' ? -48 : 48;
      $('carta').classList.add('volviendo');
      $('carta').style.transform = `translateX(${x}px) rotate(${x / 18}deg)`;
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
  // Un subtítulo al azar en cada carga de la página.
  $('subtitulo-inicio').textContent = SUBTITULOS_INICIO[Math.floor(Math.random() * SUBTITULOS_INICIO.length)];
  await cargarIlustraciones();
  pintarInicio();
}

arrancar();
