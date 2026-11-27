// Música y efectos. Se usa Web Audio porque en iOS el volumen de <audio> no se puede cambiar:
// solo así funcionan los controles de volumen (y el 0) en el iPhone.
const CLAVE = 'pena-de-vida.audio.v1';
const ARCHIVOS = {
  musica: 'assets/audio/vals-de-papel.mp3',
  carta: 'assets/audio/carta.mp3',
  comodin: 'assets/audio/comodin.mp3',
  cierre: 'assets/audio/cierre.mp3',
};
const niveles = { musica: 30, efectos: 55 };

let ctx = null;
const ganancia = {};
const sonidos = new Map(); // nombre -> promesa del buffer decodificado
let fuenteMusica = null;
let arrancando = false;

function cargarNiveles() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE));
    for (const c of Object.keys(niveles)) {
      const v = g?.[c];
      if (Number.isInteger(v) && v >= 0 && v <= 100) niveles[c] = v;
    }
  } catch {
    /* sin almacenamiento: valores por defecto */
  }
}

function guardarNiveles() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(niveles));
  } catch {
    /* nada */
  }
}

function crearContexto() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  for (const c of Object.keys(niveles)) {
    ganancia[c] = ctx.createGain();
    ganancia[c].connect(ctx.destination);
  }
  aplicarVolumen();
}

function aplicarVolumen() {
  if (!ctx) return;
  for (const c of Object.keys(niveles)) ganancia[c].gain.value = niveles[c] / 100;
}

function cargar(nombre) {
  if (!sonidos.has(nombre)) {
    sonidos.set(
      nombre,
      fetch(ARCHIVOS[nombre])
        .then((r) => r.arrayBuffer())
        .then((b) => new Promise((ok, ko) => ctx.decodeAudioData(b, ok, ko))),
    );
  }
  return sonidos.get(nombre);
}

async function arrancarMusica() {
  if (!ctx || fuenteMusica || arrancando || !niveles.musica || document.hidden) return;
  arrancando = true;
  try {
    const buffer = await cargar('musica');
    if (!fuenteMusica && niveles.musica) {
      const fuente = ctx.createBufferSource();
      fuente.buffer = buffer;
      fuente.loop = true;
      fuente.connect(ganancia.musica);
      fuente.start();
      fuenteMusica = fuente;
    }
  } catch {
    /* si el archivo no carga, se juega sin música */
  } finally {
    arrancando = false;
  }
}

function pararMusica() {
  if (!fuenteMusica) return;
  try {
    fuenteMusica.stop();
  } catch {
    /* ya parada */
  }
  fuenteMusica = null;
}

export function reproducirEfecto(nombre) {
  if (!ctx || !niveles.efectos || document.hidden) return;
  cargar(nombre)
    .then((buffer) => {
      const fuente = ctx.createBufferSource();
      fuente.buffer = buffer;
      fuente.connect(ganancia.efectos);
      fuente.start();
    })
    .catch(() => {});
}

export function prepararAudio() {
  cargarNiveles();

  // El navegador solo deja sonar audio tras un gesto del usuario.
  const desbloquear = () => {
    crearContexto();
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    arrancarMusica();
    for (const n of ['carta', 'comodin', 'cierre']) cargar(n).catch(() => {});
  };
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, desbloquear, true);

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  for (const canal of Object.keys(niveles)) {
    const control = document.getElementById('vol-' + canal);
    const salida = document.getElementById('nivel-' + canal);
    control.value = niveles[canal];
    salida.value = control.value + '%';
    control.addEventListener('input', () => {
      niveles[canal] = Number(control.value);
      salida.value = control.value + '%';
      aplicarVolumen();
      if (canal === 'musica') niveles.musica ? arrancarMusica() : pararMusica();
      guardarNiveles();
    });
    if (canal === 'efectos') control.addEventListener('change', () => reproducirEfecto('carta'));
  }

  const dialogo = document.getElementById('ajustes');
  for (const boton of document.querySelectorAll('[data-ajustes]')) boton.addEventListener('click', () => dialogo.showModal());
}
