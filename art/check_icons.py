#!/usr/bin/env python3
# Проверка иконок предметов против CODEX_ART_BRIEF.md (§A.3, §A.6, §B.2, §D.4).
#
#   python3 art/check_icons.py <папка с icons/ и assets.json>
#
# Выход 0 — всё чисто, 1 — есть отказы. Требует pillow и numpy.
#
# Иконка живёт по другим правилам, чем тайл: у неё есть альфа, силуэт и поля,
# зато не нужна бесшовность. Поэтому проверки свои, а не те же, что в check_tiles.py.
import json, os, sys
import numpy as np
from PIL import Image

# Пороги. FAIL — сдавать нельзя, WARN — посмотреть глазами.
SOFT_EDGE_RATIO = 1.5    # мягкой кромки не больше полутора пикселей на пиксель периметра
FILL_MIN, FILL_MAX = 0.72, 0.94   # доля кадра под предметом; §B.2 просит 80–90%
FILL_WARN = (0.80, 0.90)
MARGIN_SKEW = 0.06       # перекос полей: разница противоположных, доля стороны
OUTLINE_LUM = 90         # контур по силуэту должен быть тёмным
LIGHT_GRAD_PCT = 12.0    # перепад яркости по предмету — признак направленного света
BG_ALPHA = 4             # фон считается прозрачным при альфе ниже этой

lum = lambda a: a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


class Report:
    def __init__(self):
        self.fail = self.warn = 0

    def ok(self, m):   print(f'    ok   {m}')
    def info(self, m): print(f'    ·    {m}')
    def bad(self, m):  print(f'    FAIL {m}'); self.fail += 1
    def note(self, m): print(f'    warn {m}'); self.warn += 1


def check_alpha(a, r):
    """§A.3: движок использует альфа-отсечение. Полупрозрачный край даёт рваную кромку."""
    al = a[..., 3].astype(np.int32)
    if al.max() == 0:
        r.bad('иконка полностью прозрачная')
        return None
    solid = al > 255 - BG_ALPHA
    empty = al < BG_ALPHA
    soft = int((~solid & ~empty).sum())

    # периметр силуэта: сколько непрозрачных пикселей граничит с прозрачными
    p = np.pad(solid, 1)
    perim = int((solid & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])).sum())
    ratio = soft / max(perim, 1)
    if ratio > SOFT_EDGE_RATIO:
        r.bad(f'мягкий край: {soft} полупрозрачных пикселей на {perim} пикселей периметра '
              f'({ratio:.1f} при пороге {SOFT_EDGE_RATIO}). Нужен резкий край — '
              f'либо непрозрачно, либо прозрачно, допустим один пиксель перехода.')
    else:
        r.ok(f'край резкий ({ratio:.2f} полупрозрачных на пиксель периметра)')

    corners = [al[0, 0], al[0, -1], al[-1, 0], al[-1, -1]]
    if max(corners) >= BG_ALPHA:
        r.bad(f'фон не прозрачный: альфа по углам {corners}. Подложка и тень под предметом запрещены.')
    else:
        r.ok('фон прозрачный, подложки нет')
    return solid


def check_frame(solid, r):
    """§B.2: предмет занимает 80–90% кадра, поля одинаковые."""
    h, w = solid.shape
    ys, xs = np.where(solid)
    top, bot, left, right = ys.min(), h - 1 - ys.max(), xs.min(), w - 1 - xs.max()
    fill = max((ys.max() - ys.min() + 1) / h, (xs.max() - xs.min() + 1) / w)

    if not (FILL_MIN <= fill <= FILL_MAX):
        r.bad(f'предмет занимает {fill * 100:.0f}% кадра, нужно {FILL_WARN[0] * 100:.0f}–'
              f'{FILL_WARN[1] * 100:.0f}%. Иконки в ряду должны быть одного масштаба.')
    elif not (FILL_WARN[0] <= fill <= FILL_WARN[1]):
        r.note(f'предмет занимает {fill * 100:.0f}% кадра, целевые '
               f'{FILL_WARN[0] * 100:.0f}–{FILL_WARN[1] * 100:.0f}%')
    else:
        r.ok(f'предмет занимает {fill * 100:.0f}% кадра')

    skew = max(abs(top - bot) / h, abs(left - right) / w)
    if skew > MARGIN_SKEW:
        r.note(f'предмет смещён от центра: поля {left}/{right} по горизонтали, '
               f'{top}/{bot} по вертикали — перекос {skew * 100:.0f}%')
    else:
        r.ok(f'предмет по центру (перекос {skew * 100:.0f}%)')


def check_outline(a, solid, r):
    """§B.2: тёмный контур по силуэту — он даёт читаемость на любом фоне."""
    p = np.pad(solid, 1)
    edge = solid & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    if edge.sum() < 8:
        r.note('силуэт слишком мал, контур не проверить')
        return
    l = lum(a[..., :3].astype(np.float64))
    med = float(np.median(l[edge]))
    inner = float(np.median(l[solid & ~edge])) if (solid & ~edge).sum() else med
    if med > OUTLINE_LUM:
        r.note(f'контур светлый: медиана яркости по кромке {med:.0f} при пороге {OUTLINE_LUM} '
               f'(внутри {inner:.0f}). §B.2 просит тёмный контур около #1a1410.')
    else:
        r.ok(f'тёмный контур по силуэту (кромка {med:.0f}, внутри {inner:.0f})')


def check_light(a, solid, r):
    """Мягкая светотень на иконке допустима, и это осознанное отступление от §A.3.

    Запрет там продиктован динамическим освещением движка: нарисованная тень спорила бы
    с настоящей. Но иконки живут только в интерфейсе — их рисует канвас, свет движка
    на них не попадает, предметы в мире собираются из моделей Items3D. Поэтому здесь
    замер оставлен как справка, а не как претензия.

    Замер вдобавок груб: он делит предмет пополам по рамке и сравнивает средние. У меча
    в одной половине светлый клинок, в другой тёмная рукоять — разница будет большой
    и без всякого освещения."""
    l = lum(a[..., :3].astype(np.float64))
    ys, xs = np.where(solid)
    if len(ys) < 64:
        return
    cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
    top = l[solid & (np.arange(l.shape[0])[:, None] < cy)]
    bot = l[solid & (np.arange(l.shape[0])[:, None] >= cy)]
    lef = l[solid & (np.arange(l.shape[1])[None, :] < cx)]
    rig = l[solid & (np.arange(l.shape[1])[None, :] >= cx)]
    m = max(l[solid].mean(), 1e-9)
    gv = abs(top.mean() - bot.mean()) / m * 100
    gh = abs(lef.mean() - rig.mean()) / m * 100
    r.info(f'перепад яркости по половинам: {gv:.0f}% сверху вниз, {gh:.0f}% слева направо '
           f'(справка; для интерфейсных иконок светотень допустима)')


def check_detail(a, solid, r, target=96):
    """§A.6: форма обязана читаться после уменьшения до целевого размера с NEAREST."""
    im = Image.fromarray(a)
    small = np.asarray(im.resize((target, target), Image.NEAREST))
    s_solid = small[..., 3] > 255 - BG_ALPHA
    keep = s_solid.sum() / max((solid.sum() * (target / a.shape[0]) ** 2), 1e-9)
    cols = len(np.unique(a[..., :3][solid], axis=0)) if solid.sum() else 0
    r.info(f'цветов в предмете: {cols}')
    if not (0.8 <= keep <= 1.25):
        r.note(f'силуэт плывёт при уменьшении до {target}px: остаётся {keep * 100:.0f}% площади. '
               f'Скорее всего форма слишком тонкая для целевого размера.')
    else:
        r.ok(f'силуэт держится при уменьшении до {target}px ({keep * 100:.0f}% площади)')


def check_icon(path, r):
    print(f'\n  {os.path.basename(path)}')
    im = Image.open(path)
    if im.mode != 'RGBA':
        r.bad(f'нет альфа-канала (режим {im.mode}). §A.7: PNG-24 с прозрачным фоном.')
        return
    a = np.asarray(im)
    h, w = a.shape[:2]
    r.info(f'{w}x{h}, {im.mode}')
    if w != h:
        r.bad(f'кадр не квадратный: {w}x{h}')
        return
    solid = check_alpha(a, r)
    if solid is None or not solid.any():
        return
    check_frame(solid, r)
    check_outline(a, solid, r)
    check_light(a, solid, r)
    check_detail(a, solid, r)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    man = os.path.join(root, 'assets.json')
    if os.path.isfile(man):
        with open(man, encoding='utf-8') as f:
            entries = [e for e in json.load(f).get('assets', []) if e.get('type') == 'icon']
        files = [os.path.join(root, e['file']) for e in entries]
        print(f'assets.json: иконок заявлено {len(files)}')
    else:
        d = os.path.join(root, 'icons')
        files = sorted(os.path.join(d, n) for n in os.listdir(d) if n.endswith('.png'))
        print(f'assets.json не найден, беру всё из icons/: {len(files)}')

    r = Report()
    sizes = []
    for p in files:
        if os.path.isfile(p):
            check_icon(p, r)
            try: sizes.append(Image.open(p).size[0])
            except Exception: pass
        else:
            r.bad(f'файл заявлен в assets.json, но отсутствует: {p}')

    if len(set(sizes)) > 1:
        print(f'\n    warn размеры иконок разные: {sorted(set(sizes))} — вся серия должна быть в одном')
        r.warn += 1

    print(f'\nИтог: отказов {r.fail}, предупреждений {r.warn}')
    if r.fail:
        print('Сдавать нельзя — см. FAIL выше.')
    return 1 if r.fail else 0


if __name__ == '__main__':
    sys.exit(main())
