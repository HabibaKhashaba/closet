import sys, pathlib, runpy, json, re
R4=pathlib.Path('/home/claude/src2/closet/docs/milestone2/rev4'); R5=R4.parent/'rev5'
sys.path[:0]=[str(R4),str(R5)]
import docbase
CAP={}
class P(type(pathlib.Path())):
    def unlink(self,*a,**k): pass
def render(html,out,title): CAP[title]=html; return P(out)
docbase.render=render; docbase.merge=lambda *a,**k:None
# keep images as file refs instead of base64
def img(name, caption=None, width='100%'):
    p=docbase.DIAG/name
    return f'<figure class="diag"><img src="file://{p}"/><figcaption>{caption or ""}</figcaption></figure>'
docbase.img=img
sys.argv=['x','/dev/null','/tmp/x.pdf']
runpy.run_path(str(R4/'build_srs.py')); runpy.run_path(str(R4/'build_sdd.py'))
m=runpy.run_path(str(R5/'build_rev5.py'))
m['srs'](); m['sdd']()
out={}
for t,h in CAP.items():
    k=('srs' if 'Requirements' in t else 'sdd')+('5' if 'rev. 5' in t else '4')
    out[k]=h
json.dump(out,open(sys.argv[1] if False else '/tmp/claude-0/-home-claude/9efb93b1-43eb-5797-9e1b-67bf2830dbac/scratchpad/v2/rev.json','w'))
print({k:len(v) for k,v in out.items()})
