#!/usr/bin/env python3
# Готовит релиз: собирает HTML и APK, считает sha256, обновляет version.json и CHANGELOG.
#   python3 tools/release.py 1.8 --notes "Обновление из игры" "Ещё что-то"
# Дальше:  git commit -am "v1.8" && git tag v1.8 && git push --follow-tags
# Файлы из dist/ прикладываются к релизу на GitHub (вручную или через .github/workflows/release.yml).
import argparse, hashlib, json, os, re, subprocess, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = 'Giperzvuk/Grimhold3d'

def sh(cmd):
    print('$', cmd)
    subprocess.run(cmd, shell=True, check=True, cwd=ROOT)

def read(p):
    return open(os.path.join(ROOT, p), encoding='utf-8').read()

def write(p, s):
    open(os.path.join(ROOT, p), 'w', encoding='utf-8').write(s)

def bump(version, code):
    # версия и versionCode живут в трёх местах — расхождение ломает обновление, поэтому правим разом
    m = read('android/AndroidManifest.xml')
    m = re.sub(r'android:versionCode="\d+"', f'android:versionCode="{code}"', m)
    m = re.sub(r'android:versionName="[^"]+"', f'android:versionName="{version}"', m)
    write('android/AndroidManifest.xml', m)
    g = read('game/game.js')
    g = re.sub(r"const VERSION = '[^']+';", f"const VERSION = '{version}';", g, count=1)
    write('game/game.js', g)
    u = read('game/update.js')
    u = re.sub(r'const CODE = \d+;', f'const CODE = {code};', u, count=1)
    write('game/update.js', u)

def current():
    m = read('android/AndroidManifest.xml')
    return re.search(r'android:versionName="([^"]+)"', m).group(1), int(re.search(r'android:versionCode="(\d+)"', m).group(1))

def sha256(p):
    h = hashlib.sha256()
    with open(os.path.join(ROOT, p), 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('version')
    ap.add_argument('--code', type=int, help='versionCode; по умолчанию текущий + 1')
    ap.add_argument('--notes', nargs='*', default=[], help='строки списка изменений')
    ap.add_argument('--critical', action='store_true', help='пометить обновление как важное')
    ap.add_argument('--skip-apk', action='store_true')
    a = ap.parse_args()

    _, cur_code = current()
    code = a.code if a.code else cur_code + 1
    if code <= cur_code and not a.code:
        sys.exit('versionCode должен расти, иначе Android не поставит обновление поверх')
    bump(a.version, code)

    sh('python3 build_html.py')
    if not a.skip_apk:
        sh('bash build_apk.sh')

    base = f'https://github.com/{REPO}/releases/download/v{a.version}/'
    apk = 'dist/Grimhold3D.apk'
    man = {
        'version': a.version,
        'versionCode': code,
        'date': datetime.date.today().isoformat(),
        'critical': bool(a.critical),
        'notes': a.notes,
        'apk': base + 'Grimhold3D.apk',
        'html': base + 'Grimhold3D.html',
        'web': f'https://{REPO.split("/")[0].lower()}.github.io/{REPO.split("/")[1]}/',
        'page': f'https://github.com/{REPO}/releases/tag/v{a.version}',
    }
    if os.path.exists(os.path.join(ROOT, apk)):
        man['apkSize'] = os.path.getsize(os.path.join(ROOT, apk))
        man['apkSha256'] = sha256(apk)
    write('version.json', json.dumps(man, ensure_ascii=False, indent=2) + '\n')

    ch = read('CHANGELOG.md') if os.path.exists(os.path.join(ROOT, 'CHANGELOG.md')) else '# Изменения\n'
    entry = f'\n## v{a.version} · {man["date"]} · versionCode {code}\n\n' + ('\n'.join('- ' + n for n in a.notes) or '- без описания') + '\n'
    head, _, tail = ch.partition('\n')
    write('CHANGELOG.md', head + '\n' + entry + tail)

    print('\nversion.json готов. Дальше:')
    print(f'  git add -A && git commit -m "v{a.version}" && git tag v{a.version} && git push --follow-tags')
    print(f'  и приложить dist/Grimhold3D.apk и dist/Grimhold3D.html к релизу v{a.version}')

main()
