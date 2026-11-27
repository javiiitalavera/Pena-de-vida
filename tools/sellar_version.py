#!/usr/bin/env python3
"""Sella la versión del código en index.html y revisor.html para que el móvil no use copias viejas.

Calcula una huella del contenido de css/ y js/ y la añade como ?v=... a la hoja de estilos,
al script principal y a un import map con todos los módulos (así también se renuevan los
módulos que importa main.js). Si el código no cambia, la huella tampoco: la caché sigue valiendo.

Uso: python3 tools/sellar_version.py            (sella)
     python3 tools/sellar_version.py --comprobar (falla si falta sellar; lo usa GitHub)
"""
import hashlib, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
archivos = sorted(list((RAIZ / 'css').glob('*.css')) + list((RAIZ / 'js').glob('*.js')))
h = hashlib.sha1()
for f in archivos:
    h.update(f.name.encode()); h.update(f.read_bytes())
v = h.hexdigest()[:8]

modulos = sorted(f.name for f in (RAIZ / 'js').glob('*.js'))
mapa = ',\n'.join(f'      "./js/{m}": "./js/{m}?v={v}"' for m in modulos)
bloque = f'<script type="importmap">\n  {{\n    "imports": {{\n{mapa}\n    }}\n  }}\n  </script>'

cambiados = []
for nombre in ('index.html', 'revisor.html'):
    ruta = RAIZ / nombre
    html = original = ruta.read_text()
    html = re.sub(r'href="(css/[^"?]+\.css)(\?v=\w+)?"', rf'href="\1?v={v}"', html)
    html = re.sub(r'src="(js/[^"?]+\.js)(\?v=\w+)?"', rf'src="\1?v={v}"', html)
    if '<script type="importmap">' in html:
        html = re.sub(r'<script type="importmap">.*?</script>', bloque, html, flags=re.S)
    else:  # el import map debe ir antes del primer módulo
        html = html.replace('<script type="module"', bloque + '\n  <script type="module"', 1)
    if html != original:
        cambiados.append(nombre)
        if '--comprobar' not in sys.argv:
            ruta.write_text(html)

if '--comprobar' in sys.argv:
    if cambiados:
        print(f'Falta sellar la versión en: {", ".join(cambiados)}. Ejecuta python3 tools/sellar_version.py')
        sys.exit(1)
    print(f'Versión sellada correctamente ({v}).')
else:
    print(f'Versión {v}: ' + (', '.join(cambiados) if cambiados else 'sin cambios'))
