#!/usr/bin/env python3
# Проверка тайлов поверхностей против CODEX_ART_BRIEF.md (§A.3, §A.5, §A.6, §B.1, §D.4).
# Считает то, что глазами не поймать: зеркальность, ширину общей кромки, запечённый свет.
#
#   python3 art/check_tiles.py <папка с tiles/ и assets.json>
#
# Выход 0 — всё чисто, 1 — есть отказы. Требует pillow и numpy.
import json, os, sys
import numpy as np
from PIL import Image

# Пороги. FAIL — сдавать нельзя, WARN — посмотреть глазами.
MIRROR_RATIO   = 0.35   # зеркало/база ниже этого — тайл построен отражением
SEAM_RATIO     = 2.0    # разрыв на замыкании против внутреннего перепада
PERIMETER_PCT  = 5.0    # общая у всех вариантов кромка, % от стороны квадранта
BRIGHT_SPREAD  = 6.0    # разброс средней яркости между вариантами
LIGHT_GRAD_PCT = 8.0    # перепад яркости по кадру — признак направленного света
VIGNETTE_PCT   = 8.0    # разница яркости края и центра
SEAM_SIGMA     = 4.0    # внутренний шов: провал яркости против обычных колебаний
SHIFT_RATIO    = 0.45   # варианты как циклические сдвиги одного исходника

lum = lambda a: a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


class Report:
    def __init__(self):
        self.fail = self.warn = 0

    def ok(self, msg):
        print(f'    ok   {msg}')

    def info(self, msg):
        print(f'    ·    {msg}')

    def bad(self, msg):
        print(f'    FAIL {msg}')
        self.fail += 1

    def note(self, msg):
        print(f'    warn {msg}')
        self.warn += 1


def quadrants(a):
    """Тайл — сетка 2x2 из четырёх вариантов одной поверхности (§B.1)."""
    h, w = a.shape[:2]
    qh, qw = h // 2, w // 2
    return [a[0:qh, 0:qw], a[0:qh, qw:w], a[qh:h, 0:qw], a[qh:h, qw:w]]


def check_mirror(Q, r):
    """Отражение — дешёвый способ получить бесшовность, дающий видимый калейдоскоп."""
    worst = None
    for i, q in enumerate(Q):
        f = q.astype(np.float64)
        lr = np.abs(f - f[:, ::-1]).mean()
        ud = np.abs(f - f[::-1, :]).mean()
        # база: насколько кадр вообще не похож сам на себя при произвольном сдвиге
        base = np.abs(f - np.roll(f, (f.shape[0] // 3, f.shape[1] // 7), (0, 1))).mean()
        ratio = min(lr, ud) / max(base, 1e-9)
        if worst is None or ratio < worst[1]:
            worst = (i, ratio)
    i, ratio = worst
    if ratio < MIRROR_RATIO:
        r.bad(f'зеркальная симметрия: квадрант {i} отличается от своего зеркала в '
              f'{1 / max(ratio, 1e-9):.0f}x слабее, чем от случайного сдвига '
              f'(порог {1 / MIRROR_RATIO:.1f}x). Бесшовность добыта отражением.')
    else:
        r.ok(f'без зеркальной симметрии (худший квадрант {i}: {ratio:.2f} при пороге {MIRROR_RATIO})')


def check_seams(Q, r):
    """Замыкание края в край: перепад на стыке должен быть как внутри кадра."""
    worst = 0.0
    dup = 0
    for q in Q:
        f = q.astype(np.float64)
        wh = np.abs(f[:, 0] - f[:, -1]).mean()
        wv = np.abs(f[0, :] - f[-1, :]).mean()
        ih = np.abs(f[:, 1:] - f[:, :-1]).mean()
        iv = np.abs(f[1:, :] - f[:-1, :]).mean()
        worst = max(worst, wh / max(ih, 1e-9), wv / max(iv, 1e-9))
        if wh == 0 and wv == 0:
            dup += 1
    if worst > SEAM_RATIO:
        r.bad(f'видимый шов на замыкании: перепад в {worst:.1f}x больше внутреннего')
    else:
        r.ok(f'швы замыкаются (худший {worst:.2f} при пороге {SEAM_RATIO})')
    if dup:
        r.info(f'у {dup} из 4 квадрантов противоположные края совпадают точь-в-точь — '
               f'при укладке столбец дублируется. Не брак, но чище, когда край продолжает '
               f'противоположный, а не повторяет его.')


def check_perimeter(Q, r):
    """Общая кромка обязана быть — иначе варианты не состыкуются между собой.
    Но она должна быть узкой: широкая полоса делает варианты одинаковыми."""
    st = np.stack([q.astype(np.float64) for q in Q])
    qs = st.shape[1]
    col = np.abs(st - st.mean(0)).mean(axis=(0, 1, 3))
    row = np.abs(st - st.mean(0)).mean(axis=(0, 2, 3))
    thr = 1.0
    width = lambda v: int(np.argmax(v > thr)) if (v > thr).any() else len(v)
    band = max(width(col), width(col[::-1]), width(row), width(row[::-1]))
    pct = band / qs * 100

    # какая доля площади квадранта одинакова у всех четырёх вариантов
    inner = max(qs - 2 * band, 0)
    same = (1 - (inner / qs) ** 2) * 100

    if pct > PERIMETER_PCT:
        r.bad(f'общая кромка {band}px из {qs}px ({pct:.0f}% стороны) — одинаковы у всех '
              f'вариантов {same:.0f}% площади тайла. Стыковка требует лишь узкой полосы; '
              f'цель — не больше {PERIMETER_PCT:.0f}% ({int(qs * PERIMETER_PCT / 100)}px).')
    else:
        r.ok(f'общая кромка {band}px из {qs}px ({pct:.1f}%), одинаково {same:.0f}% площади')

    # края всех вариантов обязаны совпадать, иначе комбинации разойдутся
    edges_ok = all(np.array_equal(Q[0][:, 0], q[:, 0]) and np.array_equal(Q[0][0, :], q[0, :])
                   for q in Q[1:])
    if edges_ok:
        r.ok('края всех четырёх вариантов совпадают — любая комбинация состыкуется')
    else:
        r.bad('края вариантов различаются — при случайной раскладке будут расходиться стыки')


def check_inner_seam(Q, r):
    """Заживление шва после сдвига оставляет внутри кадра тёмную линию.
    Внешние края она не трогает, поэтому проверкой швов не ловится."""
    worst = (0, 0, 0.0, 0.0)
    for i, q in enumerate(Q):
        l = lum(q.astype(np.float64))
        for axis, v in ((0, l.mean(0)), (1, l.mean(1))):
            k = max(len(v) // 32, 3) | 1
            local = np.convolve(np.pad(v, (k // 2, k // 2), mode='wrap'), np.ones(k) / k, 'valid')
            d = v - local
            sig = abs(d.min()) / max(d.std(), 1e-9)
            if sig > worst[2]:
                worst = (i, axis, sig, abs(d.min()) / max(v.mean(), 1e-9) * 100)
    i, axis, sig, pct = worst
    where = 'по столбцам' if axis == 0 else 'по строкам'
    if sig > SEAM_SIGMA:
        r.note(f'внутренний шов: квадрант {i} {where} — провал яркости {sig:.1f}σ '
               f'({pct:.0f}% от средней) при пороге {SEAM_SIGMA}σ. Похоже на след заживления '
               f'после сдвига. Если материал ровный, линия может проступить решёткой.')
    else:
        r.ok(f'внутренних швов нет (худший {sig:.1f}σ при пороге {SEAM_SIGMA}σ)')


def check_shifted(Q, r):
    """Четыре варианта, полученные сдвигом одного исходника, содержат те же детали
    в других местах. §B.1 просит другие детали: другую трещину, другое пятно мха."""
    S = [lum(np.asarray(Image.fromarray(q).resize((64, 64), Image.BOX).convert('RGB'),
                        dtype=np.float64)) for q in Q]
    hits, offs = 0, []
    for i in range(4):
        for j in range(i + 1, 4):
            # шаг обязан быть по одному: смещения бывают нечётными, и на шаге 2
            # пик проходится мимо, а совпадение при сдвиге на пиксель уже разваливается
            diffs = np.array([[np.abs(S[i] - np.roll(S[j], (dy, dx), (0, 1))).mean()
                               for dx in range(64)] for dy in range(64)])
            best, mean = diffs.min(), diffs.mean()
            if best < mean * SHIFT_RATIO:
                hits += 1
                p = np.unravel_index(diffs.argmin(), diffs.shape)
                offs.append(f'{i}~{j}@{p[0]},{p[1]}')
    if hits >= 3:
        r.note(f'варианты похожи на сдвиги одного исходника: {hits} пар из 6 '
               f'({", ".join(offs)}). Повтор по сетке это ломает, но детали во всех '
               f'вариантах одни и те же — §B.1 просит разные.')
    else:
        r.ok(f'варианты не сводятся друг к другу сдвигом ({hits} пар из 6)')


def check_light(Q, r):
    """§A.3: запечённые тени, направленный свет и виньетки запрещены."""
    grad_bad, vig_bad = [], []
    for i, q in enumerate(Q):
        l = lum(q.astype(np.float64))
        s = np.asarray(Image.fromarray(l.astype(np.uint8)).resize((8, 8), Image.BOX), dtype=np.float64)
        gx = s[:, -1].mean() - s[:, 0].mean()
        gy = s[-1, :].mean() - s[0, :].mean()
        amp = np.hypot(gx, gy) / max(s.mean(), 1e-9) * 100
        if amp > LIGHT_GRAD_PCT:
            grad_bad.append((i, amp))

        b, qs = max(l.shape[0] // 64, 4), l.shape[0]
        ring = np.concatenate([l[:b].ravel(), l[-b:].ravel(), l[:, :b].ravel(), l[:, -b:].ravel()])
        c = qs // 8
        cen = l[qs // 2 - c:qs // 2 + c, qs // 2 - c:qs // 2 + c]
        d = (cen.mean() - ring.mean()) / max(cen.mean(), 1e-9) * 100
        if abs(d) > VIGNETTE_PCT:
            vig_bad.append((i, d))

    if grad_bad:
        r.bad('направленный свет: ' + ', '.join(f'квадрант {i} — перепад {a:.0f}% по кадру'
                                                for i, a in grad_bad))
    else:
        r.ok('равномерная освещённость, направленного света нет')
    if vig_bad:
        r.bad('рамка по краю кадра: ' + ', '.join(
            f'квадрант {i} — край {"светлее" if d < 0 else "темнее"} центра на {abs(d):.0f}%'
            for i, d in vig_bad))
    else:
        r.ok('виньетки и затемнения по краям нет')


def check_tone(Q, r):
    """Варианты обязаны совпадать по яркости, иначе на карте пойдут шахматные пятна."""
    means = [lum(q.astype(np.float64)).mean() for q in Q]
    spread = max(means) - min(means)
    txt = ' '.join(f'{m:.1f}' for m in means)
    if spread > BRIGHT_SPREAD:
        r.bad(f'яркость вариантов расходится на {spread:.1f} ({txt}) при допуске {BRIGHT_SPREAD}')
    else:
        r.ok(f'яркость вариантов сходится: разброс {spread:.1f} ({txt})')


def check_detail(a, Q, r):
    """§A.6: форма обязана читаться после уменьшения до целевого размера с NEAREST."""
    cols = len(np.unique(a.reshape(-1, a.shape[-1]), axis=0))
    r.info(f'уникальных цветов: {cols}')
    src = lum(Q[0].astype(np.float64)).std()
    small = np.asarray(Image.fromarray(Q[0]).resize((256, 256), Image.NEAREST).convert('RGB'),
                       dtype=np.float64)
    dst = lum(small).std()
    keep = dst / max(src, 1e-9) * 100
    if keep < 70:
        r.note(f'после NEAREST до 256 контраст падает до {keep:.0f}% (σ {src:.1f} → {dst:.1f}) — '
               f'деталь слишком мелкая для целевого размера')
    else:
        r.ok(f'деталь переживает NEAREST до 256: σ {src:.1f} → {dst:.1f}')


# door и doorLocked — не тайлы: §B.1 просит одно полотно на всю грань. Движок кладёт их
# через tile() наравне с остальными, поэтому четыре одинаковых квадранта — верное
# решение, а не брак: какой квадрант ни выбери, полотно то же.
SINGLE_PANEL = {'door', 'doorLocked'}

def check_tile(path, r):
    print(f'\n  {os.path.basename(path)}')
    im = Image.open(path)
    a = np.asarray(im.convert('RGB'))
    h, w = a.shape[:2]
    if w != h:
        r.bad(f'тайл не квадратный: {w}x{h}')
        return
    if w % 2 or (w // 2) % 2:
        r.bad(f'сторона {w} не делится на четыре варианта без остатка')
        return
    r.info(f'{w}x{h}, {im.mode}')
    Q = quadrants(a)
    single = os.path.basename(path)[:-4] in SINGLE_PANEL
    if single:
        r.info('одно полотно на всю грань (§B.1) — на четыре разных варианта не проверяю')
    check_mirror(Q, r)
    check_seams(Q, r)
    check_perimeter(Q, r)
    check_inner_seam(Q, r)
    if not single:
        check_shifted(Q, r)
    check_light(Q, r)
    check_tone(Q, r)
    check_detail(a, Q, r)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    man = os.path.join(root, 'assets.json')
    if os.path.isfile(man):
        with open(man, encoding='utf-8') as f:
            entries = [e for e in json.load(f).get('assets', []) if e.get('type') == 'tile']
        files = [os.path.join(root, e['file']) for e in entries]
        print(f'assets.json: тайлов заявлено {len(files)}')
    else:
        files = sorted(os.path.join(root, 'tiles', n)
                       for n in os.listdir(os.path.join(root, 'tiles')) if n.endswith('.png'))
        print(f'assets.json не найден, беру всё из tiles/: {len(files)}')

    r = Report()
    for p in files:
        if os.path.isfile(p):
            check_tile(p, r)
        else:
            r.bad(f'файл заявлен в assets.json, но отсутствует: {p}')

    print(f'\nИтог: отказов {r.fail}, предупреждений {r.warn}')
    if r.fail:
        print('Сдавать нельзя — см. FAIL выше.')
    return 1 if r.fail else 0


if __name__ == '__main__':
    sys.exit(main())
