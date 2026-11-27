// Imágenes: primero la de la carta, luego la del personaje, y si no hay ninguna, un placeholder.

export function rutasImagen(config, carta) {
  const plantillas = config.imagenes || {};
  const rutas = [];
  if (plantillas.cartas) rutas.push(plantillas.cartas.replace('{id}', carta.id));
  if (carta.personaje && plantillas.personajes) rutas.push(plantillas.personajes.replace('{personaje}', carta.personaje));
  return rutas;
}

function iniciales(nombre = '') {
  const palabras = nombre
    .replace(/^(el|la|los|las|tu|tus|un|una)\s+/i, '')
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(p));
  return (palabras[0]?.[0] || '?').toUpperCase();
}

function tono(texto = '') {
  let h = 0;
  for (const ch of texto) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function montarImagen(contenedor, config, carta) {
  contenedor.replaceChildren();
  const ph = document.createElement('div');
  ph.className = 'placeholder';
  ph.style.setProperty('--tono', tono(carta.personaje || carta.id));
  ph.textContent = iniciales(carta.nombre);
  contenedor.append(ph);

  const rutas = rutasImagen(config, carta);
  if (!rutas.length) return;
  let i = 0;
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.onload = () => {
    contenedor.append(img);
    ph.remove();
  };
  img.onerror = () => {
    i += 1;
    if (i < rutas.length) img.src = rutas[i];
  };
  img.src = rutas[0];
}

export function existeImagen(ruta) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = ruta;
  });
}
