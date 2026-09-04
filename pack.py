import sys, zipfile, struct
src, dex, out = sys.argv[1:4]
zin = zipfile.ZipFile(src)
zout = zipfile.ZipFile(out, 'w')
def add(name, data):
    stored = name == 'resources.arsc' or name.endswith(('.png', '.jpg', '.ogg', '.mp3', '.webp'))
    zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    zi.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    if stored:  # выравнивание данных на 4 байта (zipalign)
        off = zout.fp.tell(); nb = len(name.encode('utf-8'))
        pad = (-(off + 30 + nb)) % 4
        if pad: pad += 4; zi.extra = struct.pack('<HH', 0xd935, pad - 4) + b'\0' * (pad - 4)
    zout.writestr(zi, data)
for n in zin.namelist():
    if n.endswith('/'): continue
    add(n, zin.read(n))
add('classes.dex', open(dex, 'rb').read())
zout.close()
# проверка выравнивания
z = zipfile.ZipFile(out)
for zi in z.infolist():
    if zi.compress_type == zipfile.ZIP_STORED:
        doff = zi.header_offset + 30 + len(zi.filename.encode()) + len(zi.extra)
        assert doff % 4 == 0, (zi.filename, doff)
print('packed', len(z.namelist()), 'entries; alignment ok')
