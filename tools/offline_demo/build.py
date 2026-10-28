# Bakes the built web app, the offline backend bundle and the seed photos into ONE html file.
# Usage: python3 tools/offline_demo/build.py <client dist> <offline bundle .js> <seed photos dir> <out.html>
import sys, json, base64, pathlib, io
from PIL import Image
dist, bundle, photos_dir, out = map(pathlib.Path, sys.argv[1:5])
def small(path, size=640, q=80):
    im = Image.open(path).convert('RGB'); im.thumbnail((size, size))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
photos = {p.stem: small(p) for p in sorted(photos_dir.glob('*.jpg'))}          # photo_key = file name (seed data)
art = {f'/art/{p.name}': small(p, 900, 82) for p in sorted((dist / 'art').glob('*.jpg'))}
css = (dist / 'assets/main.css').read_text() if (dist / 'assets/main.css').exists() else ''.join(p.read_text() for p in (dist / 'assets').glob('*.css'))
js_files = sorted((dist / 'assets').glob('*.js'))
js = (dist / 'assets/main.js').read_text() if (dist / 'assets/main.js').exists() else js_files[0].read_text()
for k, v in art.items(): js = js.replace(k, v)
for f in list((dist / 'fonts').glob('*.ttf')) + list((dist / 'fonts').glob('*.otf')):
    if f'/fonts/{f.name}' in css: css = css.replace(f'/fonts/{f.name}', f"data:font/{f.suffix[1:]};base64," + base64.b64encode(f.read_bytes()).decode())
head = (dist / 'index.html').read_text()
head = head[:head.index('<body>')].replace('</head>', '')
for tag in ('<script type="module"', '<link rel="stylesheet" href="/assets', '<script defer src="/assets', '<link rel="modulepreload"'):
    while tag in head:
        i = head.index(tag); j = head.index('>', i) + 1
        if head[i:j].startswith('<script'): j = head.index('</script>', j) + 9
        head = head[:i] + head[j:]
offline = pathlib.Path(bundle).read_text()
# Lora + Inter embedded, so the offline demo looks the same without internet (both SIL Open Font License).
FONTS = [('Lora', 'normal', '400 700', 'Lora-Variable.ttf', 'truetype'), ('Lora', 'italic', '400 700', 'Lora-Italic-Variable.ttf', 'truetype'),
         ('Inter', 'normal', '300 500', 'Inter-Regular.otf', 'opentype'), ('Inter', 'normal', '600 800', 'Inter-SemiBold.otf', 'opentype')]
font_css = ''
for fam, style, weight, name, fmt in ([] if '@font-face' in css and 'Lora' in css else FONTS):
    for d in [dist / 'fonts', pathlib.Path('/usr/share/fonts/truetype/google-fonts'), pathlib.Path('/usr/share/fonts/opentype/inter')]:
        f = d / name
        if f.exists():
            font_css += f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{weight};font-display:swap;src:url(data:font/{'ttf' if fmt == 'truetype' else 'otf'};base64,{base64.b64encode(f.read_bytes()).decode()}) format('{fmt}')}}"
            break
head = head.replace('<link rel="stylesheet" href="https://fonts.googleapis.com', '<link rel="x-online-fonts" href="https://fonts.googleapis.com')
html = (head + f'<style>{font_css}{css}</style>'
        + f'<script>window.__CLOSET_PHOTOS__={json.dumps(photos)};window.__CLOSET_ART__={json.dumps(art)};</script>'
        + f'<script>{offline.replace("</script", "<\\/script")}</script></head><body><div id="root"></div>'
        + f'<script>{js.replace("</script", "<\\/script")}</script></body></html>')
pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
pathlib.Path(out).write_text(html)
print(out, len(html) // 1024, 'KB')
