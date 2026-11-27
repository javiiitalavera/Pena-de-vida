// Gesto de deslizar la carta. Avisa al arrastrar (para la vista previa) y al soltar más allá del umbral.
export function activarSwipe(el, { alMover, alSoltar, alCancelar }) {
  let inicioX = 0;
  let inicioT = 0;
  let dx = 0;
  let activo = false;
  let bloqueado = false;

  const lado = (x) => (x < 0 ? 'izquierda' : 'derecha');

  el.addEventListener('pointerdown', (e) => {
    if (bloqueado || e.button > 0) return;
    activo = true;
    inicioX = e.clientX;
    inicioT = performance.now();
    dx = 0;
    el.setPointerCapture(e.pointerId);
    el.classList.remove('volviendo', 'entrando');
    el.classList.add('arrastrando');
  });

  el.addEventListener('pointermove', (e) => {
    if (!activo) return;
    dx = e.clientX - inicioX;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    alMover(Math.abs(dx) > 18 ? lado(dx) : null, Math.min(1, Math.abs(dx) / (el.offsetWidth * 0.3)));
  });

  const terminar = () => {
    if (!activo) return;
    activo = false;
    el.classList.remove('arrastrando');
    const velocidad = Math.abs(dx) / Math.max(1, performance.now() - inicioT);
    if (Math.abs(dx) > el.offsetWidth * 0.3 || (Math.abs(dx) > 40 && velocidad > 0.6)) {
      alSoltar(lado(dx));
    } else {
      volver(el);
      alCancelar();
    }
  };
  el.addEventListener('pointerup', terminar);
  el.addEventListener('pointercancel', terminar);

  return {
    bloquear(v) { bloqueado = v; },
  };
}

export function volver(el) {
  el.classList.add('volviendo');
  el.style.transform = '';
}

export function lanzar(el, lado) {
  return new Promise((res) => {
    const x = (lado === 'izquierda' ? -1 : 1) * window.innerWidth;
    el.classList.remove('arrastrando', 'volviendo');
    el.classList.add('saliendo');
    el.style.transform = `translateX(${x}px) rotate(${x / 18}deg)`;
    setTimeout(res, 300);
  });
}

export function entrar(el) {
  el.classList.remove('saliendo', 'volviendo', 'arrastrando');
  el.style.transform = '';
  void el.offsetWidth;
  el.classList.add('entrando');
}
