#!/usr/bin/env python3
# Текст релиза для GitHub: список изменений из version.json
import json, os, sys
m = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'version.json'), encoding='utf-8'))
notes = '\n'.join('- ' + s for s in m.get('notes', [])) or '- без описания'
out = f"{notes}\n\nversionCode {m['versionCode']}\n"
if m.get('critical'):
    out = "**Важное обновление.**\n\n" + out
sys.stdout.write(out)
