# Builds Closet_v3_Studio_Features.pdf from the markdown (same look as the v2.0 documents).
import markdown, pathlib, base64, subprocess, sys
D = pathlib.Path(__file__).parent
md = (D / 'Closet_v3_Studio_Features.md').read_text()
html = markdown.markdown(md, extensions=['tables'])
for svg in ['class_studio.svg', 'seq_cher.svg']:
    data = base64.b64encode((D / svg).read_bytes()).decode()
    html = html.replace(f'src="{svg}"', f'src="data:image/svg+xml;base64,{data}" style="max-width:100%;max-height:620px;display:block;margin:6pt auto"')
css = (D.parent / 'v2.css').read_text()
extra = 'h1{font-size:24pt;margin:0 0 12pt;padding-bottom:6pt;border-bottom:2pt solid #c48a86} code{font-family:"Liberation Mono",monospace;font-size:9pt;background:#f5e6e3;padding:0 3pt;border-radius:3pt} ol{margin:0 0 8pt 16pt} td code{font-size:8.5pt}'
out = D / 'Closet_v3_Studio_Features.html'
out.write_text(f'<!doctype html><html><head><meta charset="utf-8"><title>Closet v3.0 Studio features</title><style>{css}{extra}</style></head><body data-doc="v3.0 Studio features">{html}</body></html>')
subprocess.run(['node', str(D.parent / 'render.js'), str(out), str(D.parent / 'Closet_v3.0_Studio_Features.pdf'), 'Closet v3.0 · Studio features'], check=True)
out.unlink()
print('ok')
