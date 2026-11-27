const clave = 'pena-de-vida.audio.v1';
const musica = new Audio('assets/audio/vals-de-papel.mp3');
musica.loop = true;
musica.preload = 'none';
const efectos = Object.fromEntries(['carta', 'comodin', 'cierre'].map(nombre => {
  const sonido = new Audio();
  sonido.preload = 'none';
  sonido.src = 'assets/audio/' + nombre + '.mp3';
  return [nombre, sonido];
}));

export function reproducirEfecto(nombre) {
  const sonido = efectos[nombre];
  if (document.hidden || !sonido.volume) return;
  sonido.currentTime = 0;
  sonido.play().catch(() => {});
}

export function prepararAudio() {
  const niveles = { musica: 30, efectos: 55 };
  try {
    const guardados = JSON.parse(localStorage.getItem(clave));
    for (const canal of Object.keys(niveles)) {
      const valor = guardados?.[canal];
      if (Number.isInteger(valor) && valor >= 0 && valor <= 100) niveles[canal] = valor;
    }
  } catch {}
  let iniciado = false;
  function actualizar() {
    musica.volume = niveles.musica / 100;
    for (const sonido of Object.values(efectos)) sonido.volume = niveles.efectos / 100;
    if (document.hidden || !niveles.musica) musica.pause();
    else if (iniciado && musica.paused) musica.play().catch(() => {});
  }
  for (const canal of Object.keys(niveles)) {
    const control = document.getElementById('vol-' + canal);
    const salida = document.getElementById('nivel-' + canal);
    control.value = niveles[canal];
    salida.value = control.value + '%';
    control.addEventListener('input', () => {
      niveles[canal] = Number(control.value);
      salida.value = control.value + '%';
      actualizar();
      try { localStorage.setItem(clave, JSON.stringify(niveles)); } catch {}
    });
    if (canal === 'efectos') control.addEventListener('change', () => reproducirEfecto('carta'));
  }
  actualizar();
  document.addEventListener('click', () => { iniciado = true; actualizar(); }, true);
  document.addEventListener('visibilitychange', () => {
    actualizar();
    if (document.hidden) for (const sonido of Object.values(efectos)) sonido.pause();
  });
  const dialogo = document.getElementById('ajustes');
  for (const boton of document.querySelectorAll('[data-ajustes]')) {
    boton.addEventListener('click', () => dialogo.showModal());
  }
}
