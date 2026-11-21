# AI Model Evaluation and Selection Case Study as a PDF in the same style as the SRS/SDD v2.0 (v2.css).
# Source text: extra/case_study/case_study.md (exported from the team's living doc). Charts: case_study_charts.py.
import pathlib, re, subprocess, sys, markdown
HERE = pathlib.Path(__file__).parent; CS = HERE / 'extra/case_study'; OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(exist_ok=True)
CSS = (HERE / 'v2.css').read_text()
EXTRA = '''.mini-cover{background:linear-gradient(120deg,#fbf1ef,#f5e6e3 60%,#f6eedb);border-radius:18pt;padding:18pt 22pt;margin-bottom:16pt}
.mc-k{font-size:8pt;letter-spacing:2.5pt;text-transform:uppercase;color:#9c5f5b;font-weight:bold}.mc-b{font-size:40pt;font-style:italic;font-weight:bold;line-height:1;margin-top:4pt}
.mc-t{font-size:19pt;font-weight:bold;margin-top:6pt;line-height:1.15}.mc-s{font-size:11pt;color:#6f6461;margin-top:4pt;font-style:italic}.mc-m{font-size:9pt;color:#6f6461;margin-top:8pt}
h2{color:#9c5f5b;border-bottom:1pt solid #ecd9d5;padding-bottom:2pt;margin-top:16pt} h2.app{break-before:page} h3{margin:10pt 0 4pt}
pre{white-space:pre-wrap;font-size:8.2pt;line-height:1.3;background:#fbf7f4;border:0.8pt solid #ece4dd;border-radius:8pt;padding:7pt 9pt;break-inside:auto}
.verdict{background:#f6eedb;border-radius:10pt;padding:8pt 11pt;margin:8pt 0}.verdict p{margin:2pt 0}'''
md = (CS / 'case_study.md').read_text()
md = re.sub(r'^# .*\n+.*@\w+.*\n+\*\*.*\*\*\n+.*Team Closet.*\n', '', md, count=1)  # title, byline, subtitle, team line → cover
charts = iter([('cs_by_test_light.png', 'Per-experiment scores (team-assigned, out of 100).'),
               ('cs_final_light.png', 'Final overall scores beside the average of the four experiments; the two are separate measures.'),
               ('cs_architecture.png', 'Proposed API integration architecture.')])
def fig(_):
    f, cap = next(charts); return f'\n<figure><img src="file://{CS / f}"/><figcaption>{cap}</figcaption></figure>\n'
md = re.sub(r'^.*embedded content:.*$', fig, md, flags=re.M)
md = md.replace('```text', '```')
html = markdown.markdown(md, extensions=['tables', 'fenced_code'])
html = re.sub(r'<h2>(Appendix A)', r'<h2 class="app">\1', html)
html = re.sub(r'(<p><strong>Preferred AI provider:</strong>.*?</p>\s*<p><strong>Basis:</strong>.*?</p>\s*<p><strong>API integration validation:</strong>.*?</p>)', r'<div class="verdict">\1</div>', html, flags=re.S)
cover = '''<div class="mini-cover"><div class="mc-k">CSCE 3701 · Software Engineering · AUC · Milestones 3–4</div><div class="mc-b">Closet</div>
<div class="mc-t">AI Outfit Recommendation Model Evaluation and Selection</div><div class="mc-s">A Requirements-Driven Comparative Case Study of ChatGPT, Gemini, and Claude</div>
<div class="mc-m">Team Closet — Habiba Khashaba · Youssef Ezzeldin · Bashar Elazony · Karim Eid · Salma Fahim<br/>Instructor: Dr. Sherif Aly · November 2026</div></div>'''
title = 'AI Model Evaluation and Selection Case Study'
hp = OUT / 'Closet_AI_Model_Selection_Case_Study.html'
hp.write_text(f'<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><style>{CSS}{EXTRA}</style></head><body data-doc="{title}">{cover}{html}</body></html>')
subprocess.run(['node', str(HERE / 'render.js'), str(hp), str(OUT / 'Closet_AI_Model_Selection_Case_Study.pdf'), title], check=True)
print('ok')
