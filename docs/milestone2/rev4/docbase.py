# Shared styling and PDF rendering for the Milestone 2 final documents (revision 4, build v1.5).
# HTML → PDF through Chromium (Playwright), A4, the same visual language as the app and the v1.1 documents.
import base64, json, os, pathlib, subprocess
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
DIAG = REPO / 'docs/milestone2/diagrams'
EVID = REPO / 'docs/milestone2/evidence/v15'
FONT = {'lora': '/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf', 'inter': '/usr/share/fonts/opentype/inter/Inter-Regular.otf', 'inter6': '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'}
for k, alt in [('lora', REPO / 'client/public/fonts/Lora-Variable.ttf'), ('inter', REPO / 'client/public/fonts/Inter-Regular.otf'), ('inter6', REPO / 'client/public/fonts/Inter-SemiBold.otf')]:
    if not os.path.exists(FONT[k]): FONT[k] = str(alt)

def b64(path): return base64.b64encode(pathlib.Path(path).read_bytes()).decode()

CSS = f"""
@font-face {{ font-family: Lora; src: url(data:font/ttf;base64,{b64(FONT['lora'])}); font-weight: 400 700; }}
@font-face {{ font-family: Inter; src: url(data:font/otf;base64,{b64(FONT['inter'])}); font-weight: 300 500; }}
@font-face {{ font-family: Inter; src: url(data:font/otf;base64,{b64(FONT['inter6'])}); font-weight: 600 800; }}
@page {{ size: A4; margin: 20mm 17mm 18mm 17mm; }}
body {{ font-family: Inter, Arial, sans-serif; font-size: 10.2pt; line-height: 1.48; color: #2a2626; margin: 0; }}
h1, h2, h3, h4 {{ font-family: Lora, Georgia, serif; font-weight: 500; color: #2a2626; margin: 1.1em 0 .4em; line-height: 1.2; }}
h1 {{ font-size: 21pt; }} h2 {{ font-size: 15.5pt; border-bottom: 1px solid #e6dcd5; padding-bottom: 4px; }} h3 {{ font-size: 12.5pt; }} h4 {{ font-size: 11pt; }}
p {{ margin: .45em 0; }} ul, ol {{ margin: .3em 0 .6em 1.3em; padding: 0; }} li {{ margin: .15em 0; }}
table {{ border-collapse: collapse; width: 100%; margin: .5em 0 .9em; font-size: 8.9pt; page-break-inside: auto; }}
tr {{ page-break-inside: avoid; }}
th {{ background: #f4ece8; text-align: left; font-weight: 600; padding: 5px 6px; border-bottom: 1.5px solid #c48a86; }}
td {{ padding: 4.5px 6px; border-bottom: 1px solid #ece4de; vertical-align: top; }}
code, .mono {{ font-family: 'DejaVu Sans Mono', Menlo, monospace; font-size: 8.6pt; background: #f6f1ed; padding: 0 3px; border-radius: 3px; }}
.cover {{ height: 245mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }}
.cover h1 {{ font-size: 30pt; margin: 0 0 6px; }} .cover .sub {{ font-size: 13pt; color: #7d736f; }}
.cover .meta {{ margin-top: 40px; font-size: 10pt; }} .cover .meta td {{ border: 0; padding: 3px 12px 3px 0; }}
.kicker {{ font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase; color: #9c5f5b; font-weight: 600; }}
.new {{ background: #e3f2e6; }} .del {{ color: #b8472b; text-decoration: line-through; }}
.tag {{ display: inline-block; font-size: 7.8pt; font-weight: 600; padding: 1px 7px; border-radius: 99px; background: #efe8f3; color: #6a4b87; }}
.tag.ok {{ background: #e3f2e6; color: #2f6b4a; }} .tag.warn {{ background: #f8ecdc; color: #8a5a1e; }} .tag.bad {{ background: #f7e3e1; color: #9c3b36; }} .tag.plain {{ background: #efeae6; color: #5d5650; }}
.note {{ border-left: 3px solid #c48a86; background: #fbf5f3; padding: 8px 12px; margin: .7em 0; font-size: 9.4pt; }}
.box {{ border: 1px solid #e6dcd5; border-radius: 8px; padding: 10px 14px; margin: .7em 0; }}
figure {{ margin: .8em 0 1em; page-break-inside: avoid; }} figure img {{ width: 100%; border: 1px solid #ece4de; border-radius: 6px; }}
figcaption {{ font-size: 8.5pt; color: #7d736f; margin-top: 4px; }}
.pb {{ page-break-before: always; }} .muted {{ color: #7d736f; }} .small {{ font-size: 8.8pt; }}
.toc li {{ margin: 2px 0; }}
.kv td:first-child {{ width: 32%; font-weight: 600; }}
.big {{ font-family: Lora, Georgia, serif; font-size: 26pt; line-height: 1; }}
.stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: .8em 0; }}
.stats > div {{ border: 1px solid #e6dcd5; border-radius: 8px; padding: 10px; }} .stats span {{ display: block; font-size: 8.5pt; color: #7d736f; margin-top: 4px; }}
"""

def img(name, caption=None, width='100%'):
    p = DIAG / name
    if not p.exists(): p = pathlib.Path(name)
    data = b64(p)
    mime = 'png' if str(p).endswith('.png') else 'jpeg'
    cap = f'<figcaption>{caption}</figcaption>' if caption else ''
    return f'<figure><img style="width:{width}" src="data:image/{mime};base64,{data}"/>{cap}</figure>'

def table(head, rows, cls=''):
    h = ''.join(f'<th>{c}</th>' for c in head)
    body = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{body}</tbody></table>'

def render(html, out, header_title):
    out = pathlib.Path(out); out.parent.mkdir(parents=True, exist_ok=True)
    doc = f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{html}</body></html>'
    tmp = out.with_suffix('.html'); tmp.write_text(doc)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto(f'file://{tmp}'); pg.wait_for_timeout(400)
        pg.pdf(path=str(out), format='A4', print_background=True, display_header_footer=True,
               header_template=f'<div style="font:7.5pt Arial;color:#9a8f8a;width:100%;padding:0 17mm;display:flex;justify-content:space-between"><span>{header_title}</span><span>Closet · CSCE 3701 · Fall 2026</span></div>',
               footer_template='<div style="font:7.5pt Arial;color:#9a8f8a;width:100%;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
               margin={'top': '20mm', 'bottom': '17mm', 'left': '17mm', 'right': '17mm'})
        b.close()
    tmp.unlink()
    return out

def merge(parts, out):
    """front matter + original pages (qpdf). parts: [(pdf, 'range' or None)]"""
    args = ['qpdf', '--empty', '--pages']
    for f, r in parts: args += [str(f)] + ([r] if r else [])
    args += ['--', str(out)]
    subprocess.run(args, check=True)
    return out

def counts():
    rows = [l.strip().split(',') for l in (EVID / 'counts_v15.csv').read_text().splitlines()[1:]]
    total = sum(int(r[1]) for r in rows); passed = sum(int(r[2]) for r in rows); failed = sum(int(r[3]) for r in rows)
    unit = sum(int(r[1]) for r in rows if '/unit/' in r[0]); apit = sum(int(r[1]) for r in rows if '/api/' in r[0])
    cov = next(l for l in (EVID / 'coverage_v15.txt').read_text().splitlines() if 'all files' in l).split('|')
    return {'rows': rows, 'total': total, 'passed': passed, 'failed': failed, 'unit': unit, 'api': apit,
            'lines': cov[1].strip(), 'branches': cov[2].strip(), 'functions': cov[3].strip()}
