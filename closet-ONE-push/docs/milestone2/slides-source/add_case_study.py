# Adds the AI model selection case study (3 slides) after slide 8 and removes "A look in the mirror" (slide 27).
# New slides are clones of slide 8 (same background, rail, grain and type), with their text and pictures replaced.
import copy, sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

SRC, DST, CHARTS = sys.argv[1], sys.argv[2], sys.argv[3]
prs = Presentation(SRC)
TEMPLATE = prs.slides[7]          # slide 8: "You told us. We changed it."
MIRROR = prs.slides[26]           # slide 27: "A look in the mirror."
assert 'mirror' in ''.join(sh.text_frame.text for sh in MIRROR.shapes if sh.has_text_frame).lower()

def clone(src):
    s = prs.slides.add_slide(src.slide_layout)
    for sh in list(s.shapes): sh._element.getparent().remove(sh._element)
    RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
    for el in src.shapes._spTree.iterchildren():
        if not el.tag.endswith(('}sp', '}pic', '}cxnSp', '}grpSp')): continue
        el = copy.deepcopy(el)
        for node in el.iter():
            for attr in ('embed', 'link', 'id'):
                old = node.get(RID + attr)
                if old and old in src.part.rels:
                    rel = src.part.rels[old]
                    if rel.reltype.endswith('/slide'): node.getparent().remove(node) if False else None
                    new = s.part.relate_to(rel._target, rel.reltype, rel.is_external) if not rel.is_external else s.part.relate_to(rel.target_ref, rel.reltype, True)
                    node.set(RID + attr, new)
        s.shapes._spTree.append(el)
    return s

def by_name(s, n): return next(sh for sh in s.shapes if sh.name == n)
def set_text(sh, text):
    tf = sh.text_frame; p0 = tf.paragraphs[0]; r0 = p0.runs[0]
    for p in tf.paragraphs[1:]: p._p.getparent().remove(p._p)
    for r in p0.runs[1:]: r._r.getparent().remove(r._r)
    r0.text = text
def drop(s, names):
    for sh in list(s.shapes):
        if sh.name in names: sh._element.getparent().remove(sh._element)

ROWS = [(4, 5, 7, 9, 10), (11, 12, 14, 16, 17), (18, 19, 21, 23, 24), (25, 26, 28, 30, 31), (32, 33, 35, 37, 38)]
def rows(s, content):
    for (lb, lt, rb, rt, tag), (a, b, c) in zip(ROWS, content):
        set_text(by_name(s, f'TextBox {lt}'), a); set_text(by_name(s, f'TextBox {rt}'), b); set_text(by_name(s, f'TextBox {tag}'), c)
def notes(s, text): s.notes_slide.notes_text_frame.text = text
def all_row_shapes():
    out = []
    for r in ROWS:
        lb, lt, rb, rt, tag = r
        out += [f'Rectangle {lb}', f'TextBox {lt}', f'Connector {lb + 2}', f'Rounded Rectangle {rb}', f'Oval {rb + 1}', f'TextBox {rt}', f'TextBox {tag}']
    return out

# 1 · how we chose
s1 = clone(TEMPLATE)
set_text(by_name(s1, '!!kicker'), '01 · AI · MODEL SELECTION CASE STUDY')
set_text(by_name(s1, '!!headline'), 'We tested before we chose.')
rows(s1, [('Requirements first', '11 criteria: style, colour, occasion, weather, variety, availability, honesty about limits', 'STAGE 1'),
          ('One controlled closet', '22 pieces with IDs W01 – W22, so every suggested piece can be checked', 'STAGE 2'),
          ('Same prompt, three models', 'ChatGPT, Gemini and Claude in their chat apps, identical inputs', 'STAGE 3'),
          ('Four scenarios', 'Campus to coffee · Evening dinner · Winter at 9 °C · 8 pieces unavailable', 'STAGE 4'),
          ('Scored out of 100', 'Fashion quality and constraint compliance, scored by our team', 'STAGE 4')])
notes(s1, 'HABIBA · 0:40\nBefore putting AI into Closet we treated the choice of model as an engineering decision. We wrote down what the outfit engine must do, built one test closet of 22 pieces with IDs so we could check every suggestion, and gave ChatGPT, Gemini and Claude the same prompt in four scenarios, from a campus day to a cold 9-degree evening with pieces missing.')

# 2 · results with the charts
s2 = clone(TEMPLATE)
drop(s2, all_row_shapes())
set_text(by_name(s2, '!!kicker'), '01 · AI · RESULTS')
set_text(by_name(s2, '!!headline'), 'Claude 96 · ChatGPT 95 · Gemini 93.')
from pptx.enum.shapes import MSO_SHAPE
panel = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.55), Inches(1.8), Inches(12.25), Inches(4.85))
panel.adjustments[0] = 0.05; panel.fill.solid(); panel.fill.fore_color.rgb = RGBColor(0x24, 0x1B, 0x1C); panel.line.color.rgb = RGBColor(0x7A, 0x5C, 0x30); panel.line.width = Pt(0.75)
from pptx.oxml.ns import qn
sf = panel.fill._xPr.find(qn('a:solidFill'))[0]; a = sf.makeelement(qn('a:alpha'), {'val': '92000'}); sf.append(a)
pics = [s2.shapes.add_picture(f'{CHARTS}/cs_by_test_dark.png', Inches(0.75), Inches(1.95), width=Inches(5.9)),
        s2.shapes.add_picture(f'{CHARTS}/cs_final_dark.png', Inches(6.85), Inches(2.1), width=Inches(5.8))]
def caption(x, y, w, text):
    tb = s2.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(0.5)); tf = tb.text_frame; tf.word_wrap = True
    r = tf.paragraphs[0].add_run(); r.text = text; r.font.name = 'Arial'; r.font.size = Pt(11); r.font.color.rgb = RGBColor(0xE8, 0xD3, 0xA6)
caption(0.9, 5.65, 5.7, 'Four experiments, scored out of 100: Claude and ChatGPT within two points every time; Gemini fell to 79 in the cold.')
caption(7.0, 5.65, 5.6, 'Final overall scores (filled) beside the four-test averages (hollow). They are separate measures; both rank Claude first.')
# keep the frame (grain, spotlight, rail) above the background but under nothing important: move pictures just after the background
tree = s2.shapes._spTree
for k, p in enumerate([panel] + pics): tree.remove(p._element); tree.insert(3 + k, p._element)
notes(s2, 'HABIBA · 0:40\nAcross the four tests Claude and ChatGPT stayed within two points of each other; Gemini dropped to 79 in the winter test. Our final overall scores were Claude 96, ChatGPT 95, Gemini 93. These are separate from the four-test averages, which were 94.5, 93.75 and 88.25, but both put Claude first. The margin over ChatGPT is small, and we say so.')

# 3 · why Claude, and what is still open
s3 = clone(TEMPLATE)
set_text(by_name(s3, '!!kicker'), '01 · AI · SELECTION AND STATUS')
set_text(by_name(s3, '!!headline'), 'Why Claude, and what is still open.')
rows(s3, [('Sophisticated and practical', 'Tied or led in every scenario; the best day-to-evening looks', 'STYLE'),
          ('Respects the closet', 'Used no unavailable piece in our tests', 'CONSTRAINTS'),
          ('Admits its limits', 'At 9 °C it returned two honest outfits instead of forcing three', 'HONESTY'),
          ('Closet keeps control', 'The backend validates every piece ID; the rule engine is the fallback', 'ARCHITECTURE'),
          ('Not yet proven', 'API speed, JSON validity and cost: benchmark kit ready, not yet run', 'STAGE B · OPEN')])
notes(s3, 'HABIBA · 0:40\nWe preferred Claude because its outfits were sophisticated and practical, it respected unavailable pieces, and in the cold scenario it gave two honest outfits rather than forcing three. In Closet the model only proposes: our backend checks every piece ID and falls back to the rule engine. What is not proven yet is the API itself: speed, valid JSON and cost. Our benchmark kit is ready but has not been run, so that part is still open.')

# order: new slides right after slide 8; slide 27 (mirror) removed
lst = prs.slides._sldIdLst; ids = list(lst)
new = ids[-3:]; rest = ids[:-3]
for el in ids: lst.remove(el)
mirror_id = rest[26]
order = rest[:8] + new + rest[8:]
for el in order:
    if el is not mirror_id: lst.append(el)
prs.part.drop_rel(mirror_id.rId)
prs.save(DST); print('saved', DST, len(prs.slides._sldIdLst), 'slides')
