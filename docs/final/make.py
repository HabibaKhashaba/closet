import subprocess, re, sys, pathlib, pdfplumber, logging, html as H
logging.disable(logging.WARNING)
O = pathlib.Path(sys.argv[1])
for name, title in [('Closet_SRS_v2.0', 'Software Requirements Specification for Closet · Version 2.0'), ('Closet_SDD_v2.0', 'Software Design Document for Closet · Version 2.0')]:
    hp = O / f'{name}.html'; pdf = O / f'{name}.pdf'
    def run(): subprocess.run(['node', 'render.js', str(hp), str(pdf), title], check=True)
    run()
    src = hp.read_text()
    heads = re.findall(r'<h([12]) id="(s\d+)"[^>]*>(.*?)</h\1>', src)
    pages = [re.sub(r'\s+', ' ', (pg.extract_text() or '')) for pg in pdfplumber.open(pdf).pages]
    start = next(i for i, t in enumerate(pages) if 'Table of Contents' in t) + 1
    pos = {}; cur = start
    for lvl, aid, t in heads:
        t = re.sub(r'<span class="c[nk]">.*?</span>', '', t); key = re.sub(r'\s+', ' ', H.unescape(re.sub('<.*?>', '', t)))[:28]
        for i in range(cur, len(pages)):
            if key in pages[i]: pos[aid] = i + 1; cur = i; break
    for aid, p in pos.items(): src = src.replace(f'data-a="{aid}"', f'data-a="{aid}" data-p="{p}"')
    hp.write_text(src); run()
    print(name, len(pages), 'pages; toc entries', len(pos), 'of', len(heads))
    # cover: render alone with zero margins and swap in as page 1
    src = hp.read_text()
    cov = re.search(r'<div class="cover">.*?<!--/cover-->', src, re.S).group(0)
    css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
    ch = O / f'{name}_cover.html'; cp = O / f'{name}_cover.pdf'
    ch.write_text(f'<!doctype html><html><head><meta charset="utf-8"><style>{css} @page{{size:A4;margin:0}} .cover{{page:auto}}</style></head><body>{cov}</body></html>')
    subprocess.run(['node', 'render.js', str(ch), str(cp), ''], check=True)
    from pypdf import PdfReader, PdfWriter
    w = PdfWriter(); c = PdfReader(cp); d = PdfReader(pdf)
    w.add_page(c.pages[0])
    for pgx in d.pages[1:]: w.add_page(pgx)
    w.write(pdf); print('cover swapped', len(c.pages))
