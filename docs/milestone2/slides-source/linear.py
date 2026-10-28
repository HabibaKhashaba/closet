import re, shutil, json, subprocess, sys
D='/tmp/claude-0/deck'; W=f'{D}/w'; L=f'{D}/wl'
SK='/root/.claude/skills/synced/e542fcf5-4699-4ace-a38f-449c86c90763_6a20e36a-2515-4c7a-a85a-ebb218fdbb0a/pptx'
shutil.rmtree(L, ignore_errors=True); shutil.copytree(W, L)
ORIG=open(f'{D}/order.txt').read().split(); NEW=json.load(open(f'{D}/new_order.json'))['new']
seq=[1,2,3,4,5,7,9,10,11,12,13,14,15,'D19',20,23,24,25,'PRO',26,27]+list(range(30,38))+['D18',40,41,'D20',46,47,48,'D21',49,50,'D22','D23',52,54,55]+list(range(56,69))+[70,72,73,74,75,77,79,81,82,83,84,85,86,87,88,89,90,91,92,93,'DEF2',94,95,96,'APX',97]
files=[NEW[k] if isinstance(k,str) else ORIG[k-1] for k in seq]
p=open(f'{L}/ppt/presentation.xml').read(); rels=open(f'{L}/ppt/_rels/presentation.xml.rels').read()
f2r={b:a for a,b in re.findall(r'Id="(rId\d+)"[^>]*Target="slides/(slide\d+\.xml)"',rels)}
f2r.update(dict(re.findall(r'Target="slides/(slide\d+\.xml)"[^>]*Id="(rId\d+)"',rels)))
ids={r:m for m,r in re.findall(r'(<p:sldId [^>]*r:id="(rId\d+)"/>)',p)}
p=re.sub(r'<p:sldIdLst>.*?</p:sldIdLst>','<p:sldIdLst>'+''.join(ids[f2r[f]] for f in files)+'</p:sldIdLst>',p,flags=re.S)
open(f'{L}/ppt/presentation.xml','w').write(p)
keep=set(files)
for i,f in enumerate(files,1):
    sp=f'{L}/ppt/slides/{f}'; x=open(sp).read(); rp=f'{L}/ppt/slides/_rels/{f}.rels'; r=open(rp).read()
    # morph → fade (keep auto-advance timing off: the linear deck is clicked through)
    x=re.sub(r'<mc:AlternateContent xmlns:mc="[^"]+"><mc:Choice[^>]*Requires="p159">.*?</mc:AlternateContent>','<p:transition spd="med"><p:fade/></p:transition>',x,flags=re.S)
    x=re.sub(r'<p:transition([^>]*) advTm="\d+"',r'<p:transition\1',x)
    # links to slides that are not in the linear deck are removed
    for rid,t in re.findall(r'Id="(rId\d+)"[^>]*/slide" Target="(slide\d+\.xml)"',r):
        if t not in keep:
            x=re.sub(rf'<a:hlinkClick r:id="{rid}"[^>]*?(/>|>.*?</a:hlinkClick>)','',x,flags=re.S)
    # page number
    x=re.sub(r'(<a:off x="11231575" y="\d+"/>.*?<a:t>)\d+(</a:t>)',rf'\g<1>{i}\2',x,count=1,flags=re.S)
    x=re.sub(r'(name="PageNo".*?<a:t>)\d+(</a:t>)',rf'\g<1>{i}\2',x,count=1,flags=re.S)
    open(sp,'w').write(x)
subprocess.run([sys.executable,f'{SK}/scripts/clean.py',L],cwd=f'{SK}/scripts',check=True,capture_output=True)
# dangling slide relationships after clean
import os
names=set(os.listdir(f'{L}/ppt/slides'))
for f in os.listdir(f'{L}/ppt/slides/_rels'):
    rp=f'{L}/ppt/slides/_rels/{f}'; r=open(rp).read()
    r2=re.sub(r'<Relationship Id="rId\d+" Type="[^"]+/slide" Target="(slide\d+\.xml)"/>',lambda m: m.group(0) if m.group(1) in names else '',r)
    open(rp,'w').write(r2)
print(len(files),'linear slides')
