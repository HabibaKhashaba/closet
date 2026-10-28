# Checks the interactive deck's navigation without PowerPoint: every hyperlink points at an existing
# slide, every camera slide auto-advances, Morph is on the slides that need it, and the named objects
# that Morph pairs exist on both sides of each zoom.
import zipfile, re, json, sys
P = sys.argv[1]; M = json.load(open(sys.argv[2]))
z = zipfile.ZipFile(P)
n = len([x for x in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', x)])
ids = [m['id'] for m in M]; bad = []; out = []
names = {}
for i in range(1, n + 1):
    xml = z.read(f'ppt/slides/slide{i}.xml').decode(); rels = z.read(f'ppt/slides/_rels/slide{i}.xml.rels').decode()
    rid = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(?:\.\./slides/)?slide(\d+)\.xml"', rels))
    links = re.findall(r'<a:hlinkClick r:id="(rId\d+)"[^>]*action="ppaction://hlinksldjump"', xml)
    targets = sorted({int(rid[r]) for r in links if r in rid})
    for t in targets:
        if t < 1 or t > n: bad.append((i, t))
    morph = 'p159:morph' in xml; adv = re.search(r'advTm="(\d+)"', xml)
    names[i] = set(re.findall(r'name="(!![^"]+)"', xml))
    out.append(f'{i:3d} {ids[i-1]:<12} {"morph" if morph else "fade ":<5} {("auto " + adv.group(1) + " ms") if adv else "":<12} → ' + ', '.join(ids[t - 1] for t in targets))
print('\n'.join(out))
PAIRS = [('o_1', 'o_2'), ('o_5', 'o_6'), ('room1', 's_in'), ('s_out', 'room2'), ('room2', 'p_in'), ('p_in', 'p_fill'), ('p_fill', 'p_app'), ('p_app', 'p_demo'), ('p_bridge', 'a_open'),
         ('a_open', 'a_cam'), ('a_l1', 'a_l2'), ('a_l5', 'a_l6'), ('a_l6', 'a_stack'), ('a_stack', 'a_uml'), ('s_uml', 's_uml_u'), ('q_l1', 'q_l2'), ('q_total', 'q_proof'), ('q_bug', 'q_b2'),
         ('r_0', 'r_1'), ('f_1', 'f_2'), ('f_3', 'f_4'), ('f_6', 'f_7'), ('p_hub', 'pf_looks'), ('pf_looks', 'pf_looks_0'), ('pr_looks', 'p_hub_looks')]
pairs = [(ids.index(a) + 1, ids.index(b) + 1) for a, b in PAIRS]
for a, b in pairs:
    shared = names[a] & names[b]
    print(f'Morph pair {ids[a-1]} → {ids[b-1]}: {len(shared)} shared named objects', sorted(shared)[:6])
media = [x for x in z.namelist() if x.startswith('ppt/media/') and x.endswith('.mp4')]
ext = [i for i in range(1, n + 1) if 'TargetMode="External"' in z.read(f'ppt/slides/_rels/slide{i}.xml.rels').decode() and '.mp4' in z.read(f'ppt/slides/_rels/slide{i}.xml.rels').decode()]
print('embedded video files:', media, '· linked (external) videos:', ext or 'none')
print('broken links:', bad or 'none', '· slides:', n)
