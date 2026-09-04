#!/usr/bin/env python3
# Собирает сданные художником исходники в game/assets_data.js — карту "имя → data-URI".
#
#   python3 tools/pack_assets.py art/incoming/party1
#
# Почему data-URI, а не файлы рядом: игра обязана работать из одного HTML и из file://
# внутри APK. build_html.py вклеивает в страницу только JS, внешние PNG туда не попадут.
# Сгенерированный JS вклеивается сам собой и работает везде одинаково.
#
# Исходники приходят в максимальном разрешении (2048 и больше). В игру они едут
# уменьшенными фильтрацией NEAREST до целевого размера из §A.6 брифа: движок всё равно
# показывает их без сглаживания, а разница в весе — десятки мегабайт против сотен килобайт.
import base64, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'game', 'assets_data.js')

VARIANT = 256   # целевой размер одного варианта поверхности, §A.6: 256–512
COLORS = 64     # палитра на файл; исходники и так приходят в 29–32 цветах


def pack_tile(path):
    """Тайл — сетка 2×2 из четырёх вариантов. Уменьшаем целиком, сохраняя раскладку."""
    im = Image.open(path).convert('RGB')
    side = VARIANT * 2
    if im.size != (side, side):
        im = im.resize((side, side), Image.NEAREST)
    im = im.convert('P', palette=Image.ADAPTIVE, colors=COLORS)
    buf = io.BytesIO()
    im.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def main():
    if len(sys.argv) < 2:
        sys.exit('укажи папку со сдачей, например: python3 tools/pack_assets.py art/incoming/party1')
    src = sys.argv[1]
    man = os.path.join(src, 'assets.json')
    if os.path.isfile(man):
        with open(man, encoding='utf-8') as f:
            entries = [e for e in json.load(f).get('assets', []) if e.get('type') == 'tile']
    else:
        tiles = os.path.join(src, 'tiles')
        entries = [{'name': n[:-4], 'file': f'tiles/{n}'}
                   for n in sorted(os.listdir(tiles)) if n.endswith('.png')]

    out, total = {}, 0
    for e in entries:
        p = os.path.join(src, e['file'])
        if not os.path.isfile(p):
            print(f'  пропуск: нет файла {e["file"]}')
            continue
        data = pack_tile(p)
        total += len(data)
        out[e['name']] = 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')
        print(f'  {e["name"]:12} {os.path.getsize(p)//1024:5} КБ → {len(data)//1024:4} КБ')

    body = ',\n'.join(f'  {k}: "{v}"' for k, v in sorted(out.items()))
    js = ('// Сгенерировано tools/pack_assets.py — руками не править.\n'
          f'// Поверхности из художественной сдачи, {VARIANT}px на вариант, сетка 2×2.\n'
          'const ASSET_DATA = { tiles: {\n' + body + '\n} };\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)

    print(f'\n{OUT}: {len(out)} поверхностей, {total//1024} КБ картинок, '
          f'{os.path.getsize(OUT)//1024} КБ файла')
    if not out:
        print('Ничего не упаковано — проверь путь.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
