# Bakes the built web app + the recorded API calls into ONE html file that opens without a server.
# Usage: python3 tools/offline_demo/build.py <client dist dir> <recording.json> <out.html>
import sys, json, base64, re, pathlib
dist, recf, out = map(pathlib.Path, sys.argv[1:4])
rec = json.load(open(recf))
photos = rec['photos']
from PIL import Image; import io
def small(u):  # 640 px is plenty for cards and the try-on
    im = Image.open(io.BytesIO(base64.b64decode(u.split(',', 1)[1]))).convert('RGB'); im.thumbnail((640, 640))
    b = io.BytesIO(); im.save(b, 'JPEG', quality=78); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
photos = {k: small(v) for k, v in photos.items()}
def fix(o):  # signed photo URLs → embedded images
    s = json.dumps(o)
    s = re.sub(r'/api/v1/photos/([^?"]+)\?[^"]*', lambda m: 'ph:' + m.group(1), s)
    return json.loads(s)
calls = [dict(c, d=fix(c['d'])) for c in rec['calls']]
login = next(c for c in calls if c['p'] == '/auth/login' and c['s'] == 200)
token = login['d']['token']
calls.insert(0, {'m': 'GET', 'p': '/auth/me', 'b': None, 's': 200, 'd': {'user': login['d']['user']}})
calls.insert(0, {'m': 'POST', 'p': '/auth/logout', 'b': None, 's': 204, 'd': None})
art = {f'/art/{p.name}': 'data:image/jpeg;base64,' + base64.b64encode(p.read_bytes()).decode() for p in (dist / 'art').glob('*.jpg')}
css = (dist / 'assets/main.css').read_text()
js = (dist / 'assets/main.js').read_text()
for k, v in art.items(): js = js.replace(k, v)
mock = r"""
(function(){
  var CALLS = __CALLS__, ART = __ART__, PH = __PH__, cur = -1;
  try { if (!sessionStorage.getItem('closet.token')) sessionStorage.setItem('closet.token', __TOKEN__); } catch (e) {}
  function strip(b){ if(!b||b==='<form>') return b; try{ var o=JSON.parse(b); delete o.date; return o; }catch(e){ return b; } }
  function score(a,b){ if(a===b) return 100; if(!a||!b||typeof a!=='object'||typeof b!=='object') return 0;
    if(JSON.stringify(a)===JSON.stringify(b)) return 100; var n=0; for(var k in a){ if(JSON.stringify(a[k])===JSON.stringify(b[k])) n++; } return n; }
  function pick(m,p,body){
    var path=p.split('?')[0], want=strip(body), best=-1, bs=-1;
    for (var pass=0; pass<2 && best<0; pass++) for (var i=0;i<CALLS.length;i++){ var c=CALLS[i];
      if (c.m!==m) continue; if (pass===0 ? c.p!==p : c.p.split('?')[0]!==path) continue;
      var s=(m==='GET'?1:score(want,strip(c.b)))*1000 + (i>cur ? 500-Math.min(499,i-cur) : 100-Math.min(99,(cur-i)/3));
      if (s>bs){ bs=s; best=i; } }
    return best; }
  var real = window.fetch.bind(window);
  window.fetch = function(url, opt){
    if (typeof url!=='string' || url.indexOf('/api/v1')!==0) return real(url, opt);
    opt = opt||{}; var m=(opt.method||'GET').toUpperCase(), p=url.slice(7), body=typeof opt.body==='string'?opt.body:(opt.body?'<form>':null);
    var i = pick(m,p,body), c = i>=0 ? CALLS[i] : null;
    if (c && m!=='GET') cur = i; else if (c && i>cur && m==='GET' && i-cur<4) cur = i;
    var status = c ? c.s : (m==='GET' ? 200 : 200), data = c ? c.d : (m==='GET' ? {} : {ok:true});
    return new Promise(function(r){ setTimeout(function(){ r(new Response(status===204?null:JSON.stringify(data).replace(/"ph:([^"]+)"/g,function(_,k){return '"'+(PH[k]||'')+'"';}),{status:status,headers:{'Content-Type':'application/json'}})); }, 120); });
  };
  new MutationObserver(function(){ document.querySelectorAll('img[src^="/art/"]').forEach(function(im){ var u=ART[im.getAttribute('src')]; if(u) im.src=u; }); }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  document.addEventListener('DOMContentLoaded', function(){ var d=document.createElement('div'); d.textContent='Offline demo · recorded data from the seeded account';
    d.style.cssText='position:fixed;left:12px;bottom:10px;z-index:99999;font:600 11px Inter,Arial,sans-serif;color:#6b5e58;background:rgba(255,253,251,.92);border:1px solid #e2d8d0;padding:5px 10px;border-radius:999px;pointer-events:none';
    document.body.appendChild(d); });
})();
""".replace('__CALLS__', json.dumps(calls, separators=(',', ':'))).replace('__ART__', json.dumps(art)).replace('__PH__', json.dumps(photos)).replace('__TOKEN__', json.dumps(token))
head = (dist / 'index.html').read_text()
head = head[:head.index('<body>')].replace('</head>', '')
html = (head + f'<style>{css}</style><script>{mock}</script></head><body><div id="root"></div><script>{js.replace("</script", "<\\/script")}</script></body></html>')
out.write_text(html)
print(out, len(html) // 1024, 'KB')
