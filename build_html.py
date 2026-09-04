# Собирает две одностраничные версии игры из game/:
#   dist/Grimhold3D.html — всё внутри, включая babylon.js (работает без сети, годится для file://)
#   docs/index.html      — babylon.js с CDN (лёгкая, для GitHub Pages и артефакта claude.ai)
import os, re, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
G = os.path.join(ROOT, 'game')
NAMES = ['textures.js', 'assets_data.js', 'assets.js', 'music.js', 'world.js', 'terrain.js', 'models.js', 'items3d.js', 'render.js',
         'game.js', 'input.js', 'layout.js', 'craft.js', 'voice.js', 'story.js', 'update.js', 'ui.js']
CDN = 'https://cdnjs.cloudflare.com/ajax/libs/babylonjs/7.54.3/babylon.js'
src = lambda n: open(os.path.join(G, n), encoding='utf-8').read()

html = src('index.html')
tags = '<script src="babylon.js"></script>\n' + ''.join(f'<script src="{n}"></script>\n' for n in NAMES)
tags = tags.rstrip('\n')
assert tags in html, 'порядок тегов <script> в game/index.html разошёлся со списком NAMES'
mods = ''.join(f'<script>\n{src(n)}\n</script>\n' for n in NAMES)

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
full = html.replace(tags, '<script>\n' + src('babylon.js') + '\n</script>\n' + mods)
open(os.path.join(ROOT, 'dist', 'Grimhold3D.html'), 'w', encoding='utf-8').write(full)

# Страница для Pages — полноценный документ, а не голова с телом вперемешку.
# Раньше здесь вырезались <title>+<style> и содержимое <body>, из-за чего терялись
# DOCTYPE, charset и <meta viewport>: браузер уходил в quirks-режим, height:100%
# переставал работать, а телефон рисовал страницу на виртуальной ширине 980px.
light = html.replace(tags, f'<script src="{CDN}"></script>\n' + mods)
open(os.path.join(ROOT, 'docs', 'index.html'), 'w', encoding='utf-8').write(light)
open(os.path.join(ROOT, 'docs', '.nojekyll'), 'w').close()
print(f'dist/Grimhold3D.html {len(full)//1024} КБ · docs/index.html {len(light)//1024} КБ')
