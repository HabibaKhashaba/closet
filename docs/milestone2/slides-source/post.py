# Post-process: per-slide transitions (Morph or Fade), auto-advance for the "camera" slides,
# media de-duplication. Usage: post.py raw.pptx raw.json out.pptx interactive|linear
import sys, zipfile, re, hashlib, json
src, meta, dst, mode = sys.argv[1:5]
M = json.load(open(meta))
zin = zipfile.ZipFile(src); files = {n: zin.read(n) for n in zin.namelist()}
first, alias = {}, {}
for n in sorted(files):
    if n.startswith('ppt/media/'):
        h = hashlib.sha1(files[n]).hexdigest()
        if h in first: alias[n.split('/')[-1]] = first[h].split('/')[-1]
        else: first[h] = n
for n in list(files):
    if n.endswith('.rels') and alias:
        t = files[n].decode('utf8'); t2 = re.sub(r'\.\./media/([^"]+)', lambda m: '../media/' + alias.get(m.group(1), m.group(1)), t)
        if t2 != t: files[n] = t2.encode('utf8')
for a in alias: files.pop('ppt/media/' + a, None)
def morph(adv):
    a = f' advTm="{adv}"' if adv else ''
    return ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
            '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
            f'<p:transition spd="slow" p14:dur="1300"{a} xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"><p159:morph option="byObject"/></p:transition>'
            f'</mc:Choice><mc:Fallback><p:transition spd="slow"{a}><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')
def fade(adv): a = f' advTm="{adv}"' if adv else ''; return f'<p:transition spd="med"{a}><p:fade/></p:transition>'
for n in list(files):
    m = re.match(r'ppt/slides/slide(\d+)\.xml$', n)
    if not m: continue
    info = M[int(m.group(1)) - 1]
    tr = morph(info['adv']) if mode == 'interactive' and info['t'] == 'morph' else fade(info['adv'])
    t = files[n].decode('utf8').replace('</p:clrMapOvr>', '</p:clrMapOvr>' + tr, 1)
    files[n] = t.encode('utf8')
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for n in ['[Content_Types].xml'] + [n for n in zin.namelist() if n != '[Content_Types].xml' and n in files]: zout.writestr(n, files[n])
zout.close(); print('→', dst, len(M), 'slides; media de-duplicated:', len(alias))
