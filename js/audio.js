// Música y efectos. Se usa Web Audio porque en iOS el volumen de <audio> no se puede cambiar:
// solo así funcionan los controles de volumen (y el 0) en el iPhone.
const CLAVE = 'pena-de-vida.audio.v1';
const PISTAS = ['vals-de-papel', 'domingo-por-la-tarde', 'tramite-pendiente'];
const ARCHIVOS = {
  ...Object.fromEntries(PISTAS.map((nombre) => [nombre, 'assets/audio/' + nombre + '.mp3'])),
  boton: 'assets/audio/boton.mp3',
  abrirAjustes: 'assets/audio/abrir-ajustes.mp3',
  cerrarAjustes: 'assets/audio/cerrar-ajustes.mp3',
  carta: 'assets/audio/carta.mp3',
  comodin: 'assets/audio/comodin.mp3',
  cierre: 'assets/audio/cierre.mp3',
};
const niveles = { musica: 30, efectos: 55 };

let ctx = null;
const ganancia = {};
const sonidos = new Map(); // nombre -> promesa del buffer decodificado
let fuenteMusica = null;
let pistaActual = 0;
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
    const buffer = await cargar(PISTAS[pistaActual]).catch(async () => {
      pistaActual = 0;
      return cargar(PISTAS[pistaActual]);
    });
    if (!fuenteMusica && niveles.musica && !document.hidden) {
      const fuente = ctx.createBufferSource();
      fuente.buffer = buffer;
      fuente.connect(ganancia.musica);
      fuente.onended = () => {
        if (fuenteMusica !== fuente) return;
        fuenteMusica = null;
        pistaActual = (pistaActual + 1) % PISTAS.length;
        arrancarMusica();
      };
      fuente.start();
      fuenteMusica = fuente;
      cargar(PISTAS[(pistaActual + 1) % PISTAS.length]).catch(() => {});
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
      if (!niveles.efectos || document.hidden) return;
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
    for (const n of ['carta', 'comodin', 'cierre', 'boton', 'abrirAjustes', 'cerrarAjustes']) cargar(n).catch(() => {});
  };
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, desbloquear, true);

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().then(arrancarMusica).catch(() => {});
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
  for (const boton of document.querySelectorAll('[data-ajustes]')) {
    boton.addEventListener('click', () => {
      reproducirEfecto('abrirAjustes');
      dialogo.showModal();
    });
  }
  dialogo.addEventListener('close', () => reproducirEfecto('cerrarAjustes'));
  document.addEventListener('click', (e) => {
    const boton = e.target.closest('button');
    if (boton?.matches('#btn-nueva, #btn-continuar, #btn-otra, [data-sexo], .lista-elecciones button')) {
      reproducirEfecto('boton');
    }
  }, true);
}
