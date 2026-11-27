import { cargarDatos } from './data.js';
import { validar } from './validate.js';
import { simular } from './simulate.js';
import { aplicarGenero } from './text.js';
import { rangoCarta, LADOS } from './engine.js';
import { existeImagen } from './images.js';

const $ = (id) => document.getElementById(id);
const esc = (t = '') => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const datos = await cargarDatos();
const informe = validar(datos);
const nombrePilar = Object.fromEntries(datos.config.pilares.map((p) => [p.id, p.nombre]));

for (const b of $('pestanas').children) {
  b.addEventListener('click', () => {
    for (const x of $('pestanas').children) x.classList.toggle('activa', x === b);
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('activa', t.id === `tab-${b.dataset.tab}`);
    if (b.dataset.tab === 'imagenes') pintarImagenes();
  });
}

// ---------- resumen ----------
function pintarResumen() {
  const r = informe.resumen;
  const filas = r.etapas
    .map((e) => `<tr><td>${e.id} · ${esc(e.nombre)}</td><td>${e.anios}</td><td>${e.etapa}</td><td>${e.anclas}</td><td>${e.soloM}/${e.soloF}</td><td>${e.condicionadas}</td><td>${e.objetivo}</td>
      <td><span class="barra" style="width:${e.cobertura * 0.6}px"></span> ${e.cobertura}%</td></tr>`)
    .join('');
  const pil = Object.entries(r.pilares)
    .map(([p, v]) => `<tr><td>${esc(nombrePilar[p])}</td><td>${v.sube}</td><td>${v.baja}</td><td>${v.total > 0 ? '+' : ''}${v.total}</td></tr>`)
    .join('');
  $('tab-resumen').innerHTML = `
    <div class="cifras">
      <div class="cifra"><b>${r.total}</b><span>cartas</span></div>
      <div class="cifra"><b>${r.objetivoTotal}</b><span>para ritmo completo (${datos.config.cartas_por_anio}/año)</span></div>
      <div class="cifra"><b>${informe.errores.length}</b><span>errores</span></div>
      <div class="cifra"><b>${informe.avisos.length}</b><span>avisos</span></div>
      <div class="cifra"><b>${r.hitos}</b><span>hitos biográficos</span></div>
      <div class="cifra"><b>${r.personajes.length}</b><span>personajes</span></div>
    </div>
    <h3>Cartas por etapa</h3>
    <p class="nota">Cobertura = cartas generales (sin flags ni rasgo) + anclas, frente a las necesarias para ${datos.config.cartas_por_anio} cartas/año. Por debajo del 100% el juego salta años.</p>
    <div class="tabla-scroll"><table><thead><tr><th>Etapa</th><th>Años</th><th>Etapa</th><th>Anclas</th><th>Solo H/M</th><th>Condic.</th><th>Objetivo</th><th>Cobertura</th></tr></thead><tbody>${filas}</tbody></table></div>
    <h3>Equilibrio de pilares</h3>
    <p class="nota">Cuántas opciones suben o bajan cada barra y la suma neta. Una suma muy negativa empuja hacia la muerte por 0.</p>
    <div class="tabla-scroll"><table><thead><tr><th>Pilar</th><th>Sube</th><th>Baja</th><th>Neto</th></tr></thead><tbody>${pil}</tbody></table></div>`;
}

// ---------- avisos ----------
function pintarAvisos() {
  const err = informe.errores.map((e) => `<div class="aviso error"><span class="clase">error</span>${e.carta ? `<code>${esc(e.carta)}</code> ` : ''}${esc(e.msg)}</div>`);
  const av = informe.avisos.map((a) => `<div class="aviso"><span class="clase">${esc(a.clase)}</span>${a.carta ? `<code>${esc(a.carta)}</code> ` : ''}${esc(a.msg)}</div>`);
  $('tab-avisos').innerHTML = [...err, ...av].join('') || '<p>Todo en orden.</p>';
}

// ---------- cartas ----------
const avisosPorCarta = new Map();
for (const x of [...informe.errores.map((e) => ({ ...e, error: true })), ...informe.avisos]) {
  if (!x.carta) continue;
  avisosPorCarta.set(x.carta, [...(avisosPorCarta.get(x.carta) || []), x]);
}

for (const e of datos.config.etapas) $('f-etapa').insertAdjacentHTML('beforeend', `<option value="${e.id}">${e.id} · ${esc(e.nombre)}</option>`);
for (const r of datos.rasgos) $('s-rasgo').insertAdjacentHTML('beforeend', `<option value="${r.id}">${esc(r.nombre)}</option>`);

function etapaDeCarta(c) {
  if (c.tipo === 'etapa') return c.etapa;
  if (c.tipo === 'ancla') return datos.config.etapas.find((e) => c.anio >= e.desde && c.anio <= e.hasta)?.id;
  return null;
}

function pintarCartas() {
  const etapa = $('f-etapa').value;
  const sexo = $('f-sexo').value;
  const soloAvisos = $('f-avisos').checked;
  const q = $('f-texto').value.trim().toLowerCase();
  const g = (t) => esc(aplicarGenero(t, sexo));
  const lista = datos.cartas
    .filter((c) => !etapa || etapaDeCarta(c) === etapa)
    .filter((c) => !soloAvisos || avisosPorCarta.has(c.id))
    .filter((c) => !q || JSON.stringify(c).toLowerCase().includes(q))
    .sort((a, b) => (a.anio ?? a.edad_sugerida ?? rangoCarta(a)?.[0] ?? 0) - (b.anio ?? b.edad_sugerida ?? rangoCarta(b)?.[0] ?? 0));

  $('lista-cartas').innerHTML =
    lista
      .map((c) => {
        const cond = c.condiciones || {};
        const chips = [
          c.tipo === 'ancla' ? `ancla · año ${c.anio}` : c.tipo === 'etapa' ? `etapa ${rangoCarta(c)?.join('–')}` : c.tipo,
          c.edad_sugerida != null && `sugerida ${c.edad_sugerida}`,
          cond.requiere_sexo && `solo ${cond.requiere_sexo === 'M' ? 'hombre' : 'mujer'}`,
          cond.requiere_rasgo?.length && `rasgo: ${cond.requiere_rasgo.join(', ')}`,
          cond.excluye_rasgo?.length && `sin rasgo: ${cond.excluye_rasgo.join(', ')}`,
          cond.requiere_flags?.length && `requiere: ${cond.requiere_flags.join(', ')}`,
          cond.excluye_flags?.length && `excluye: ${cond.excluye_flags.join(', ')}`,
          cond.prioridad && `prioridad ${cond.prioridad}`,
          c.lote && `lote ${c.lote}`,
        ].filter(Boolean);
        const ops = LADOS.map((l) => {
          const o = c[l] || {};
          const ef = Object.entries(o.efectos || {})
            .map(([p, v]) => `<span class="ef ${v > 0 ? 'mas' : 'menos'}">${v > 0 ? '+' : '−'}${Math.abs(v)} ${esc(nombrePilar[p] || p)}</span>`)
            .join('');
          const flags = [
            ...(o.add_flags || []).map((f) => `+${f}`),
            ...(o.remove_flags || []).map((f) => `−${f}`),
            ...(o.encolar || []).map((e) => `encola ${e.id}`),
            o.fin && 'fin de partida',
          ].filter(Boolean);
          return `<div class="op"><div class="lado">${l}</div><div>${g(o.texto)}</div><div>${ef}</div>
            ${flags.length ? `<div>${flags.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>` : ''}
            ${o.hito_biografico ? `<div class="hito">Hito: ${g(o.hito_biografico)}</div>` : ''}</div>`;
        }).join('');
        const avs = (avisosPorCarta.get(c.id) || []).map((a) => `<div class="${a.error ? 'error' : ''}">${a.error ? '✗' : '·'} ${esc(a.msg)}</div>`).join('');
        return `<article class="carta">
          <header><h3>${g(c.nombre)}</h3><span class="meta"><code>${esc(c.id)}</code> · ${esc(c._archivo)}${c.personaje ? ` · personaje <code>${esc(c.personaje)}</code>` : ''}</span></header>
          <div>${chips.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>
          <p class="texto">${g(c.texto)}</p>
          <div class="ops">${ops}</div>
          ${avs ? `<div class="avisos-carta">${avs}</div>` : ''}
        </article>`;
      })
      .join('') || '<p>No hay cartas con esos filtros.</p>';
}
for (const id of ['f-etapa', 'f-sexo', 'f-avisos', 'f-texto']) $(id).addEventListener('input', pintarCartas);

// ---------- simular ----------
$('s-lanzar').addEventListener('click', () => {
  $('s-resultado').innerHTML = '<p>Simulando…</p>';
  setTimeout(() => {
    const s = simular(datos, { partidas: 2000, estrategia: $('s-estrategia').value, rasgo: $('s-rasgo').value, semilla: Date.now() % 100000 });
    const maxVistas = Math.max(...Object.values(s.vistas));
    const vistas = Object.entries(s.vistas)
      .sort((a, b) => a[1] - b[1])
      .map(([id, n]) => `<tr><td><code>${esc(id)}</code></td><td>${Math.round((n / s.partidas) * 100)}%</td><td style="text-align:left"><span class="barra" style="width:${(n / maxVistas) * 120}px"></span></td></tr>`)
      .join('');
    $('s-resultado').innerHTML = `
      <div class="cifras">
        <div class="cifra"><b>${s.edadMedia}</b><span>edad media al morir</span></div>
        <div class="cifra"><b>${s.mediana}</b><span>mediana</span></div>
        <div class="cifra"><b>${s.centenarios}%</b><span>llegan a 100</span></div>
        <div class="cifra"><b>${s.cartasPorPartida}</b><span>cartas por partida</span></div>
        <div class="cifra"><b>${s.hitosPorPartida}</b><span>hitos por partida</span></div>
        <div class="cifra"><b>${s.pctPocosHitos}%</b><span>necrológicas con &lt;4 hitos</span></div>
      </div>
      <h3>Causas de muerte</h3>
      <div class="tabla-scroll"><table><tbody>${s.causas.map((c) => `<tr><td>${esc(c.causa)}</td><td>${c.pct}%</td><td style="text-align:left"><span class="barra" style="width:${c.pct * 2}px"></span></td></tr>`).join('')}</tbody></table></div>
      ${$('s-rasgo').value === 'azar' ? `<h3>Edad media por rasgo</h3><div class="tabla-scroll"><table><tbody>${Object.entries(s.porRasgo).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <h3>% de partidas en que aparece cada carta</h3>
      <div class="tabla-scroll"><table><tbody>${vistas}</tbody></table></div>`;
  }, 30);
});

// ---------- imágenes ----------
let imagenesPintadas = false;
async function pintarImagenes() {
  if (imagenesPintadas) return;
  imagenesPintadas = true;
  const { cartas: pc, personajes: pp } = datos.config.imagenes;
  const rutasPers = informe.resumen.personajes.map((p) => pp.replace('{personaje}', p));
  const rutasCartas = datos.cartas.map((c) => pc.replace('{id}', c.id));
  $('tab-imagenes').innerHTML = `
    <p class="nota">Nombres exactos de archivo. Cada carta usa su imagen propia si existe; si no, la de su personaje; si no, un placeholder. Formato recomendado: PNG cuadrado (p. ej. 1024×1024).</p>
    <h3>Personajes (${rutasPers.length}) — reutilizables entre cartas</h3><div class="img-lista" id="img-pers"></div>
    <h3>Cartas (${rutasCartas.length}) — opcional, sustituye a la del personaje</h3><div class="img-lista" id="img-cartas"></div>`;
  const pintar = async (rutas, cont) => {
    const res = await Promise.all(rutas.map(existeImagen));
    $(cont).innerHTML = rutas.map((r, i) => `<div class="${res[i] ? 'ok' : 'falta'}">${res[i] ? '✓' : '○'} ${esc(r)}</div>`).join('');
  };
  pintar(rutasPers, 'img-pers');
  pintar(rutasCartas, 'img-cartas');
}

pintarResumen();
pintarAvisos();
pintarCartas();
