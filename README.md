# Pena de vida

Juego de cartas narrativo para móvil y ordenador. Vives del año 0 al 100 equilibrando cuatro barras (Salud, Dinero, Cordura, Vínculos). Si una llega a 0 o a 100, mueres y recibes tu necrológica.

Hecho con HTML, CSS y JavaScript, sin frameworks ni instalación. Todo el contenido (cartas, rasgos, muertes, comodines) está en archivos `.json` dentro de `data/`, separado del motor.

## Cómo probarlo

Los `.json` no cargan si abres `index.html` con doble clic: el navegador lo bloquea. Hay dos opciones:

- **GitHub Pages** (recomendado). En el repositorio: *Settings → Pages → Deploy from a branch*, elige la rama y la carpeta `/ (root)`. Tendrás un enlace para abrirlo en el móvil.
- **En tu ordenador**: dentro de la carpeta del proyecto, ejecuta `python3 -m http.server 8000` y abre `http://localhost:8000`.

Añade `?debug` a la dirección (`index.html?debug`) para ver los números exactos, el id de cada carta y los flags activos.

## Controles

- **Móvil**: desliza la carta a izquierda o derecha. Mientras arrastras, la respuesta aparece sobre la carta y unos puntos sobre las barras indican cuáles cambiarán.
- **Ordenador**: arrastra la carta con el ratón, o usa `←` / `→` (la primera pulsación inclina la carta y muestra la respuesta; la segunda confirma). `Esc` cancela, `C` abre el comodín.

Cada carta es un año de vida: del año 0 al 100 (`cartas_por_anio: 1` en `config.json`).

## Revisor de cartas (control de calidad)

`revisor.html` (enlace al pie de la pantalla de inicio) sirve para revisar el contenido sin terminal:

- **Resumen**: cartas por etapa frente a las necesarias y equilibrio de cada barra.
- **Avisos**: errores que rompen el juego y problemas de diseño (falsos dilemas, opciones "todo ventaja" o "todo castigo", flags que nadie activa, textos demasiado largos…).
- **Cartas**: todas las cartas con sus efectos, leídas en masculino o en femenino, con filtros.
- **Simular**: juega 2.000 partidas automáticas y muestra edad media, % que llega a 100, causas de muerte y qué cartas no salen nunca.
- **Imágenes**: los nombres exactos de archivo que hay que generar y cuáles ya existen.

Lo mismo desde terminal: `node tools/revisar.mjs`. GitHub lo ejecuta en cada subida y marca en rojo si hay errores.

## Estructura

```
index.html            juego
revisor.html          revisor de cartas
css/                  estilos
js/engine.js          motor (reglas, mazos, efectos, muerte) — sin interfaz
js/main.js            interfaz del juego
js/validate.js        comprobaciones de calidad
js/simulate.js        simulador de partidas
js/text.js            concordancia de género {o/a}
data/config.json      barras, etapas, ritmo, rutas de imágenes, lista de archivos de cartas
data/cards/*.json     cartas, un archivo por etapa
data/traits.json      rasgos pasivos
data/jokers.json      comodines
data/deaths.json      textos de muerte por barra
data/remates.json     informe forense de la necrológica: todos los condicionales que encajen + uno aleatorio
assets/cards/         imagen propia de una carta: {id}.png
assets/characters/    imagen de un personaje (se reutiliza): {personaje}.png
tools/revisar.mjs     validación + simulación por terminal
```

## Formato de una carta

```json
{
  "id": "abuela_anis",
  "tipo": "etapa",
  "etapa": "0-3",
  "edad_sugerida": 2,
  "nombre": "La Abuela",
  "personaje": "abuela",
  "texto": "Insiste en mojar tu chupete en anís…",
  "tags": ["familia"],
  "condiciones": {
    "requiere_sexo": "F",
    "requiere_rasgo": ["hijo_de_papa"],
    "excluye_rasgo": [],
    "requiere_flags": ["casado"],
    "excluye_flags": [],
    "prioridad": "alta"
  },
  "izquierda": {
    "texto": "Chuparlo con entusiasmo",
    "efectos": { "salud": -10, "vinculos": 10 },
    "hito_biografico": "Desarrolló tolerancia al alcohol antes que el habla.",
    "add_flags": ["fumador"],
    "remove_flags": [],
    "encolar": [{ "id": "id_de_carta_estado", "en_anios": [2, 5] }]
  },
  "derecha": { "texto": "Escupírselo en el ojo", "efectos": { "salud": 5, "vinculos": -10 } }
}
```

Solo son obligatorios `id`, `tipo`, `nombre`, `texto` y las dos opciones con `texto` y `efectos`. Todo lo demás es opcional.

| Campo | Para qué sirve |
|---|---|
| `id` | Único, en minúsculas y con `_`. Es también el nombre de su imagen. |
| `tipo` | `ancla` (sale en un año exacto, con `"anio": 18`), `etapa` (sale al azar dentro de su etapa) o `estado` (solo sale si otra carta la encola). |
| `etapa` | `0-3`, `4-11`, `12-17`, `18-29`, `30-49`, `50-69`, `70-89`, `90-99`, o un rango que abarque varias: `18-49`. |
| `edad` | Opcional, estrecha el rango dentro de la etapa: `[60, 69]`. |
| `edad_sugerida` | La carta tiende a salir cerca de esa edad, sin estar fijada. |
| `personaje` | Id de personaje para reutilizar la misma imagen en varias cartas. |
| `condiciones` | Filtros: sexo, rasgo, flags. Las cartas con `requiere_flags` o `requiere_rasgo` tienen prioridad alta por defecto. |
| `condiciones.probabilidad` | Entre 0 y 1: en qué proporción de partidas puede salir. Sin ella, una carta disponible sale casi siempre (el juego intenta usar todas las cartas de cada etapa). Ej.: el Divorcio tiene 0.4. |
| `hito_biografico` | Frase para la necrológica si se elige esa opción. Admite `peso_hito` (más alto = más relevante). |
| `add_flags_por_sexo` | Flags extra según el sexo: `{ "F": ["embarazada"] }`. |
| `add_flags` / `remove_flags` | Cambian el estado vital (casado, oficinista, con_hijos…). Los flags de un mismo grupo de `config.json → grupos_flags` se excluyen entre sí: al hacerte funcionario dejas de ser oficinista sin tener que escribirlo. |
| `fin` | En la carta del año 100: `"fin": "centenario"` termina la partida. |
| `lote` | Número de lote en el que llegó la carta (para seguimiento). |

**Género**: `{o/a}` se convierte según el sexo del personaje: `maj{o/a}` → majo / maja, `{el/la}`, `señor{/a}`.

**Respuestas**: cortas, de 2 a 4 palabras (máximo unos 30 caracteres): se leen sobre la carta mientras se arrastra. El revisor avisa si pasan de 32.

**Valores**: ±10 por defecto; ±15 para decisiones fuertes; ±5 para efectos secundarios.

## Cómo funciona el tiempo

- Cada carta hace avanzar la edad. Si una etapa tiene suficientes cartas, salen unas 1,5 por año (`cartas_por_anio` en `config.json`). Si tiene pocas, el juego salta años para no repetir cartas.
- Las anclas detienen el tiempo en su año exacto. Las cartas encoladas, también.
- Al llegar a 100 sale la carta del año 100, si existe, y después la necrológica de centenario.

## Rasgos

Se definen en `data/traits.json` con reglas genéricas, así que un rasgo nuevo no necesita tocar el código:

- `multiplicador`: `{ "pilar": "dinero", "signo": "negativo", "mult": 0.5 }`. `signo` puede ser `positivo`, `negativo` o `ambos`; `pilar` puede ser `*` para todos; admite `tags` para afectar solo a cartas con esas etiquetas.
- `anula`: si una opción baja X, no baja Y.
- `periodico`: efecto automático cada N años.
- `transferencia`: si una decisión baja X, suma un efecto extra (p. ej. Viejo Rencoroso: bajar Vínculos da +5 Salud).
- `inicio`: valores de partida distintos de 50.
- `desbloqueo`: `inicial`, `muerte` (pilar; `extremo` 0 o 100 es opcional: sin él vale morir por esa barra en cualquiera de los dos extremos) o `centenario`.

La primera partida empieza directamente en el año 0 como rasgo inicial y con el primer comodín, sin pantallas de elección. Si solo hay un rasgo disponible, también se salta la elección de rasgo.

Los comodines están en `data/jokers.json` con cuatro acciones: `descartar`, `invertir`, `congelar` y `efecto_directo`. También se desbloquean: `inicial`, `edad` (`min`: edad alcanzada), `muerte` (pilar y extremo opcionales) o `centenario`.
