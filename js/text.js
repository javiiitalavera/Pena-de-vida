// Concordancia de género en los textos.
// Sintaxis: {masculino/femenino}. Ejemplos: "maj{o/a}", "{el/la} mejor", "señor{/a}".
const PATRON = /\{([^{}/]*)\/([^{}/]*)\}/g;

export function aplicarGenero(texto, sexo) {
  if (typeof texto !== 'string') return texto;
  return texto.replace(PATRON, (_, m, f) => (sexo === 'F' ? f : m));
}

export function tieneGenero(texto) {
  return typeof texto === 'string' && /\{[^{}/]*\/[^{}/]*\}/.test(texto);
}

// Detecta llaves mal cerradas o sin barra: "{o-a}", "{oa", etc.
export function generoMalFormado(texto) {
  if (typeof texto !== 'string') return false;
  const limpio = texto.replace(PATRON, '');
  return /[{}]/.test(limpio);
}
