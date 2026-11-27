// Carga de datos. "leer(ruta)" devuelve el JSON de una ruta relativa a la raíz del proyecto.
// En el navegador se usa fetch; en Node (herramientas) se usa el sistema de archivos.

export async function cargarDatosCon(leer) {
  const config = await leer('data/config.json');
  const [rasgos, muertes, comodines, remates, ...lotes] = await Promise.all([
    leer('data/traits.json'),
    leer('data/deaths.json'),
    leer('data/jokers.json'),
    leer('data/remates.json'),
    ...config.archivos_cartas.map((f) => leer(`data/cards/${f}`)),
  ]);
  const cartas = lotes.flatMap((lote, i) =>
    (lote.cartas || []).map((c) => ({ ...c, _archivo: config.archivos_cartas[i] })),
  );
  return {
    config,
    rasgos: rasgos.rasgos,
    muertes: muertes.muertes,
    comodines: comodines.comodines,
    remates: remates.remates,
    cartas,
  };
}

export function cargarDatos() {
  return cargarDatosCon(async (ruta) => {
    const r = await fetch(ruta, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
    return r.json();
  });
}
