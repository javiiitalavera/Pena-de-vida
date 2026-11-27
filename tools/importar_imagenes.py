#!/usr/bin/env python3
"""Convierte las ilustraciones entregadas al formato del juego.

Uso:  python3 tools/importar_imagenes.py [carpeta]   (por defecto assets/originales)

- Cada archivo debe llamarse como el id de la carta (enchufe.png) o, si es la
  imagen de un personaje, personaje_<id>.png (personaje_abuela.png).
- Se redimensiona a 1024×1024 y se guarda en WebP (calidad 82) en
  assets/cards/<id>.webp o assets/characters/<id>.webp.
- Avisa si el nombre no coincide con ninguna carta o personaje, o si la imagen no es cuadrada.
"""
import json, os, sys
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
LADO, CALIDAD = 1024, 82
origen = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / 'assets' / 'originales'

config = json.loads((RAIZ / 'data' / 'config.json').read_text())
ids, personajes = set(), set()
for f in config['archivos_cartas']:
    for c in json.loads((RAIZ / 'data' / 'cards' / f).read_text())['cartas']:
        ids.add(c['id'])
        if c.get('personaje'):
            personajes.add(c['personaje'])

hechas, errores = 0, 0
for ruta in sorted(origen.iterdir()) if origen.exists() else []:
    if ruta.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
        continue
    nombre = ruta.stem
    if nombre.startswith('personaje_'):
        pid = nombre[len('personaje_'):]
        if pid not in personajes:
            print(f'  ✗ {ruta.name}: no hay ningún personaje "{pid}"'); errores += 1; continue
        destino = RAIZ / 'assets' / 'characters' / f'{pid}.webp'
    else:
        if nombre not in ids:
            print(f'  ✗ {ruta.name}: no hay ninguna carta con id "{nombre}"'); errores += 1; continue
        destino = RAIZ / 'assets' / 'cards' / f'{nombre}.webp'
    im = Image.open(ruta).convert('RGB')
    if abs(im.width - im.height) > 2:
        print(f'  ! {ruta.name}: no es cuadrada ({im.width}×{im.height}); se recorta al centro')
        lado = min(im.size)
        im = im.crop(((im.width - lado) // 2, (im.height - lado) // 2, (im.width + lado) // 2, (im.height + lado) // 2))
    if im.width < LADO:
        print(f'  ! {ruta.name}: mide {im.width} px, menos de {LADO}; se verá algo blanda en móviles')
    im.resize((LADO, LADO), Image.LANCZOS).save(destino, 'WEBP', quality=CALIDAD, method=6)
    print(f'  ✓ {ruta.name} → {destino.relative_to(RAIZ)} ({os.path.getsize(destino) // 1024} KB)')
    hechas += 1

# Índice de ilustraciones de carta disponibles (lo usa la portada para elegir una al azar).
disponibles = sorted(f.stem for f in (RAIZ / 'assets' / 'cards').glob('*.webp') if f.stem in ids)
(RAIZ / 'assets' / 'cards' / 'indice.json').write_text(json.dumps({'ilustraciones': disponibles}, ensure_ascii=False, indent=2) + '\n')
print(f'{hechas} imágenes importadas, {errores} con errores.')
print(f'Índice: {len(disponibles)} ilustraciones de carta.')
sys.exit(1 if errores else 0)
