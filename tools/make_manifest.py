#!/usr/bin/env python3
# Собирает version.json по факту выпущенного релиза.
#
#   python3 tools/make_manifest.py v1.9 dist/Grimhold3D.apk
#
# Версия берётся из android/AndroidManifest.xml, список изменений — из верхней секции
# CHANGELOG.md, размер и sha256 — из того самого APK, который уходит в релиз.
#
# Почему так, а не наоборот: раньше version.json писался локально до сборки, и его
# apkSha256 приходилось как-то согласовывать с тем, что соберёт раннер. Теперь сумма
# считается по опубликованному файлу, и разойтись им негде.
import hashlib, json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = 'Giperzvuk/Grimhold3d'


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


def manifest_version():
    m = read('android/AndroidManifest.xml')
    name = re.search(r'android:versionName="([^"]+)"', m).group(1)
    code = int(re.search(r'android:versionCode="(\d+)"', m).group(1))
    return name, code


def sources_agree(name, code):
    """Версия живёт в трёх местах — расхождение ломает обновление (см. README)."""
    bad = []
    v = re.search(r"const VERSION = '([^']+)';", read('game/game.js'))
    if not v or v.group(1) != name:
        bad.append(f'game/game.js VERSION={v.group(1) if v else "?"}, ожидалось {name}')
    c = re.search(r'const CODE = (\d+);', read('game/update.js'))
    if not c or int(c.group(1)) != code:
        bad.append(f'game/update.js CODE={c.group(1) if c else "?"}, ожидалось {code}')
    return bad


def notes_from_changelog(name):
    """Верхняя секция CHANGELOG.md: строки списка идут в манифест как список изменений."""
    try:
        ch = read('CHANGELOG.md')
    except FileNotFoundError:
        return []
    m = re.search(r'^##\s+v' + re.escape(name) + r'\b.*?$(.*?)(?=^##\s|\Z)', ch, re.S | re.M)
    if not m:
        return []
    return [ln[2:].strip() for ln in m.group(1).splitlines() if ln.startswith('- ')]


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def main():
    if len(sys.argv) < 2:
        sys.exit('нужен тег: python3 tools/make_manifest.py v1.9 [путь/к/Grimhold3D.apk]')
    tag = sys.argv[1]
    apk = sys.argv[2] if len(sys.argv) > 2 else None

    name, code = manifest_version()
    if tag.lstrip('v') != name:
        sys.exit(f'тег {tag} не совпадает с версией в манифесте {name}')
    bad = sources_agree(name, code)
    if bad:
        sys.exit('версия разошлась между файлами:\n  ' + '\n  '.join(bad))

    base = f'https://github.com/{REPO}/releases/download/{tag}/'
    man = {
        'version': name,
        'versionCode': code,
        'date': datetime.date.today().isoformat(),
        'critical': False,
        'notes': notes_from_changelog(name) or ['без описания'],
        'apk': base + 'Grimhold3D.apk',
        'html': base + 'Grimhold3D.html',
        'web': f'https://{REPO.split("/")[0].lower()}.github.io/{REPO.split("/")[1]}/',
        'page': f'https://github.com/{REPO}/releases/tag/{tag}',
    }
    if apk and os.path.isfile(apk):
        man['apkSize'] = os.path.getsize(apk)
        man['apkSha256'] = sha256(apk)
    else:
        print('APK не передан — манифест без apkSize и apkSha256, '
              'игра будет ставить обновление без сверки суммы', file=sys.stderr)

    out = json.dumps(man, ensure_ascii=False, indent=2) + '\n'
    with open(os.path.join(ROOT, 'version.json'), 'w', encoding='utf-8') as f:
        f.write(out)
    print(out)


if __name__ == '__main__':
    main()
