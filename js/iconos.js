// Iconos de línea (24×24, trazo con el color del texto). Se usan en comodines y ajustes.
const TRAZOS = {
  humo: '<path d="M6.5 19h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 5.8 10.4 4.3 4.3 0 0 0 6.5 19z"/><circle cx="5" cy="5" r="1.6"/><circle cx="9.5" cy="3.6" r="1"/>',
  pastilla: '<g transform="rotate(-45 12 12)"><rect x="2.5" y="8.5" width="19" height="7" rx="3.5"/><line x1="12" y1="8.5" x2="12" y2="15.5"/></g>',
  telefono: '<path d="M5 3.5h3.2l1.8 4.6-2.4 1.6a11.5 11.5 0 0 0 6.7 6.7l1.6-2.4 4.6 1.8V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  invertir: '<path d="M4 8h15l-3.5-3.5M20 16H5l3.5 3.5"/>',
  ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  salud: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  dinero: '<circle cx="12" cy="12" r="8.5"/><path d="M15 9.3a3.8 3.8 0 1 0 0 5.4M7.8 11h5M7.8 13.2h5"/>',
  cordura: '<path d="M12 5.5c-1-1.3-3.6-1.5-4.8.1-1.9-.1-3 1.9-2.4 3.4-1.6 1-1.5 3.6.1 4.4-.4 2 1.2 3.7 3.1 3.4.9 1.6 3 1.9 4 .7z"/><path d="M12 5.5c1-1.3 3.6-1.5 4.8.1 1.9-.1 3 1.9 2.4 3.4 1.6 1 1.5 3.6-.1 4.4.4 2-1.2 3.7-3.1 3.4-.9 1.6-3 1.9-4 .7z"/><path d="M12 5.5V17.5"/>',
  vinculos: '<circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9.2" r="2.4"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M14.8 14.4a4.6 4.6 0 0 1 5.7 4.6"/>',
  ficha: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  dado: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="15" cy="9" r="1.1" fill="currentColor"/><circle cx="9" cy="15" r="1.1" fill="currentColor"/>',
  comodin: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M12 8.5l1.3 2.6 2.7.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.7-.4z"/>',
};

export function icono(nombre) {
  const trazo = TRAZOS[nombre] || TRAZOS.comodin;
  return `<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazo}</svg>`;
}
