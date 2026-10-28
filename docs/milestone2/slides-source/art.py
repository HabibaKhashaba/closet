# Renders the spatial-deck art (HTML/CSS → PNG/JPG via Chromium). Every object is rendered as its
# own transparent picture with its exact position, so the deck can move each object with Morph.
import json, pathlib
from playwright.sync_api import sync_playwright
D = pathlib.Path(__file__).parent.resolve()
CUT = (D / 'cut').resolve().as_uri()
OUT = D / 'scene'; OUT.mkdir(exist_ok=True)
W, H = 2400, 1350
BASE = '<style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:2400px;height:1350px;overflow:hidden;background:transparent;font-family:Inter,Arial}</style>'

RACK = [('beige_trench_coat', 430, -6), ('navy_blazer', 360, 4), ('rose_wrap_dress', 470, -3), ('ivory_silk_blouse', 330, 5), ('camel_cardigan', 340, -4),
        ('navy_silk_midi_dress', 480, 3), ('sage_linen_shirt', 340, -5), ('blush_satin_cami', 400, 4), ('denim_jacket', 320, -3), ('black_midi_skirt', 380, 5)]
SHOES = [('nude_heels', 110), ('structured_black_bag', 170), ('black_loafers', 74), ('white_sneakers', 92), ('tan_leather_tote', 180), ('brown_ankle_boots', 128)]
X0, X1, Y0, Y1 = 600, 1800, 150, 1230      # the wardrobe opening

def hanger():
    return ('<svg width="150" height="92" viewBox="0 0 150 92" style="position:absolute;left:50%;top:-74px;margin-left:-75px">'
            '<path d="M75 34 C75 24 86 22 86 13 C86 5 80 1 75 1 C69 1 65 5 65 10" fill="none" stroke="#d9b98a" stroke-width="5" stroke-linecap="round"/>'
            '<path d="M75 34 L8 80 Q2 86 10 86 L140 86 Q148 86 142 80 Z" fill="none" stroke="#6b5040" stroke-width="7" stroke-linejoin="round"/></svg>')

def interior(lit):
    n = len(RACK); step = (X1 - X0 - 360) / (n - 1)
    items = ''.join(f'<div style="position:absolute;left:{X0 + 180 + i * step - 160:.0f}px;top:{Y0 + 170}px;width:320px;transform:rotate({r * .4}deg);transform-origin:50% -60px">{hanger()}'
                    f'<img src="{CUT}/{g}.png" style="position:absolute;left:50%;top:6px;height:{int(h * 1.45)}px;transform:translateX(-50%);filter:drop-shadow(0 22px 26px rgba(0,0,0,.6)) brightness({1 if lit else .35})"></div>'
                    for i, (g, h, r) in enumerate(RACK))
    shoes = ''.join(f'<img src="{CUT}/{g}.png" style="height:{h}px;filter:drop-shadow(0 10px 10px rgba(0,0,0,.6)) brightness({1 if lit else .35})">' for g, h in SHOES)
    glow = 'radial-gradient(900px 420px at 50% 0%,rgba(255,214,170,.42),rgba(255,214,170,0) 70%),' if lit else ''
    return (f'<div style="position:absolute;left:{X0}px;top:{Y0}px;width:{X1 - X0}px;height:{Y1 - Y0}px;overflow:hidden;background:{glow}linear-gradient(#3a2c2a,#221a1a 60%,#1a1314);box-shadow:inset 0 0 120px rgba(0,0,0,.75)">'
            f'<div style="position:absolute;left:{-X0}px;top:{-Y0}px;width:{W}px;height:{H}px">'
            f'<div style="position:absolute;left:{X0 + 30}px;top:{Y0 + 86}px;width:{X1 - X0 - 60}px;height:14px;border-radius:7px;background:linear-gradient(#f3d9a4,#b98f4e 55%,#6e5230);filter:brightness({1 if lit else .4})"></div>'
            f'{items}<div style="position:absolute;left:{X0 + 30}px;top:{Y1 - 150}px;width:{X1 - X0 - 60}px;height:120px;display:flex;align-items:flex-end;justify-content:space-around">{shoes}</div>'
            f'<div style="position:absolute;left:{X0}px;top:{Y1 - 30}px;width:{X1 - X0}px;height:30px;background:linear-gradient(#5a4440,#2a2020)"></div></div></div>')

ROOM_WALL = ('<div style="position:absolute;inset:0;background:radial-gradient(1300px 900px at 50% 30%,#2e2324,#171112 65%,#0d0a0b);"></div>'
             '<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.018) 0 2px,transparent 2px 120px)"></div>'
             '<div style="position:absolute;left:0;right:0;top:1150px;bottom:0;background:linear-gradient(#1d1617,#0c0909)"></div>'
             '<div style="position:absolute;left:0;right:0;top:1150px;height:2px;background:rgba(255,220,180,.12)"></div>')

def closet_parts():
    carcass = (f'<div style="position:absolute;left:{X0 - 46}px;top:{Y0 - 46}px;width:{X1 - X0 + 92}px;height:{Y1 - Y0 + 70}px;border-radius:10px;'
               'background:linear-gradient(#2c2122,#1a1314);box-shadow:0 60px 140px rgba(0,0,0,.75)"></div>')
    scenes = {
        'open_room': (ROOM_WALL + carcass + interior(False), False),
        'open_lit': (interior(True), True),
        'open_led': (f'<div style="position:absolute;left:{X0 - 30}px;top:{Y0 - 30}px;width:{X1 - X0 + 60}px;height:{Y1 - Y0 + 40}px;border-radius:8px;'
                     'border:5px solid #fff1dc;box-shadow:0 0 22px 6px rgba(255,214,160,.85),0 0 90px 30px rgba(255,200,140,.32),inset 0 0 22px 6px rgba(255,214,160,.5)"></div>', True),
    }
    for side, x in (('l', X0), ('r', (X0 + X1) // 2)):
        hx = 'right:44px' if side == 'l' else 'left:44px'
        scenes[f'door_{side}'] = (f'<div style="position:absolute;left:{x}px;top:{Y0}px;width:{(X1 - X0) // 2}px;height:{Y1 - Y0}px;'
            'background:linear-gradient(100deg,#2b2021,#3a2c2b 45%,#251c1d);border:2px solid #4a3a36;box-shadow:inset 0 0 0 26px rgba(0,0,0,.18),inset 0 0 0 28px rgba(255,220,180,.07)">'
            f'<div style="position:absolute;{hx};top:44%;width:14px;height:190px;border-radius:7px;background:linear-gradient(90deg,#f3d9a4,#a37a42)"></div></div>', True)
    return scenes

def room_parts():
    P = {}
    # left: Sprint door
    P['obj_door'] = ('<div style="position:absolute;left:150px;top:240px;width:420px;height:900px;border-radius:8px;background:linear-gradient(100deg,#2c2122,#3c2e2c 50%,#251c1c);'
                     'border:3px solid #5a463f;box-shadow:0 0 0 6px #1a1314,0 0 26px 4px rgba(255,214,160,.35),0 50px 80px rgba(0,0,0,.6)">'
                     '<div style="position:absolute;inset:40px;border:2px solid rgba(255,220,180,.12);border-radius:4px"></div>'
                     '<div style="position:absolute;right:46px;top:430px;width:14px;height:150px;border-radius:7px;background:linear-gradient(90deg,#f3d9a4,#a37a42)"></div></div>')
    # standing oval mirror (retrospective)
    P['obj_oval'] = ('<div style="position:absolute;left:660px;top:470px;width:190px;height:680px">'
                     '<div style="position:absolute;left:0;top:0;width:190px;height:330px;border-radius:50%;background:radial-gradient(60% 50% at 40% 35%,#e8dcd6,#9c8a84 70%,#5d4d49);border:9px solid #c9a46a;box-shadow:0 0 30px rgba(255,214,160,.25)"></div>'
                     '<div style="position:absolute;left:88px;top:320px;width:14px;height:330px;background:linear-gradient(90deg,#c9a46a,#7d6034)"></div>'
                     '<div style="position:absolute;left:30px;top:640px;width:130px;height:14px;border-radius:7px;background:#7d6034"></div></div>')
    # centre: arched mirror (Product) with bulbs
    bulbs = ''.join(f'<i style="position:absolute;left:{x}px;top:{y}px;width:26px;height:26px;border-radius:50%;background:#fff6e4;box-shadow:0 0 18px 6px rgba(255,214,160,.85)"></i>'
                    for x, y in [(290 + 300 * __import__("math").cos(__import__("math").pi - k * __import__("math").pi / 6) , 300 - 300 * __import__("math").sin(__import__("math").pi - k * __import__("math").pi / 6)) for k in range(7)] +
                    [(-14, y) for y in (420, 560, 700, 840)] + [(594, y) for y in (420, 560, 700, 840)])
    P['obj_mirror'] = ('<div style="position:absolute;left:900px;top:130px;width:620px;height:980px">'
                       '<div style="position:absolute;inset:0;border-radius:310px 310px 20px 20px;background:linear-gradient(180deg,#e9d7bf,#b9976c);box-shadow:0 50px 90px rgba(0,0,0,.6)"></div>'
                       '<div style="position:absolute;inset:22px;border-radius:290px 290px 10px 10px;background:linear-gradient(170deg,#efe4dc,#cbb8ae 55%,#9b8780);box-shadow:inset 0 0 60px rgba(255,255,255,.6)"></div>'
                       f'<div style="position:absolute;left:0;top:0;width:620px;height:980px">{bulbs}</div></div>')
    # right: glass wall panel (Inside the system) with a glowing layered schematic
    lines = ''.join(f'<div style="position:absolute;left:60px;right:60px;top:{70 + i * 86}px;height:52px;border-radius:10px;border:2px solid rgba(255,214,160,{.75 - i * .09});'
                    f'background:rgba(255,214,160,{.10 - i * .012});box-shadow:0 0 18px rgba(255,214,160,{.35 - i * .04})"></div>' for i in range(6))
    P['obj_panel'] = ('<div style="position:absolute;left:1680px;top:170px;width:500px;height:600px;border-radius:14px;background:linear-gradient(160deg,rgba(60,48,46,.95),rgba(28,22,22,.95));'
                      f'border:3px solid #5a463f;box-shadow:0 0 0 6px #1a1314,0 40px 70px rgba(0,0,0,.6)">{lines}</div>')
    # dresser with the glowing Quality drawer
    P['obj_dresser'] = ('<div style="position:absolute;left:1640px;top:930px;width:600px;height:230px;border-radius:8px;background:linear-gradient(#3c2e2c,#241b1b);border:3px solid #5a463f;box-shadow:0 40px 60px rgba(0,0,0,.6)">'
                        '<div style="position:absolute;left:20px;right:20px;top:20px;height:86px;border-radius:6px;background:linear-gradient(#4a3935,#332726);border:2px solid #c9a46a;box-shadow:0 0 24px rgba(255,214,160,.45)">'
                        '<div style="position:absolute;left:50%;top:36px;width:110px;height:12px;margin-left:-55px;border-radius:6px;background:linear-gradient(#f3d9a4,#a37a42)"></div></div>'
                        '<div style="position:absolute;left:20px;right:20px;top:122px;height:86px;border-radius:6px;background:linear-gradient(#3a2d2b,#2a201f);border:2px solid #4a3a36">'
                        '<div style="position:absolute;left:50%;top:36px;width:110px;height:12px;margin-left:-55px;border-radius:6px;background:#7d6034"></div></div></div>')
    # jewellery box on the dresser (Documents)
    P['obj_box'] = ('<div style="position:absolute;left:2080px;top:858px;width:140px;height:70px;border-radius:8px;background:linear-gradient(#e9c9c4,#b98a85);border:3px solid #c9a46a;box-shadow:0 10px 18px rgba(0,0,0,.5)">'
                    '<div style="position:absolute;left:-6px;right:-6px;top:-14px;height:24px;border-radius:8px;background:linear-gradient(#f2d7d2,#c79a95);border:3px solid #c9a46a"></div></div>')
    P['room_led'] = ('<div style="position:absolute;left:0;right:0;top:56px;height:6px;background:#fff1dc;box-shadow:0 0 22px 8px rgba(255,214,160,.8),0 0 120px 40px rgba(255,200,140,.25)"></div>')
    return P

# a closed laptop (lid shut) for the Inside-the-system scene
LAPTOP_CLOSED = ('<div style="position:absolute;left:700px;top:560px;width:1000px;height:300px;perspective:1600px">'
                 '<div style="position:absolute;left:0;top:0;width:1000px;height:260px;border-radius:20px;background:linear-gradient(170deg,#4a4244,#211d1e);transform:rotateX(62deg);box-shadow:0 40px 80px rgba(0,0,0,.7),inset 0 0 0 2px rgba(255,255,255,.08)">'
                 '<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:600 54px Lora,Georgia;color:rgba(255,240,225,.55)">closet<span style="color:#c48a86">.</span></div></div>'
                 '<div style="position:absolute;left:-40px;top:150px;width:1080px;height:26px;border-radius:0 0 22px 22px;background:linear-gradient(#cfc6c0,#7d7570)"></div></div>')

def render(name, html, transparent=True, full=False, jpg=False):
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
        tmp = OUT / f'_{name}.html'; tmp.write_text('<html><head>' + BASE + '</head><body>' + html + '</body></html>')
        pg.goto(tmp.as_uri()); pg.wait_for_timeout(700); tmp.unlink()
        path = OUT / f'{name}.{"jpg" if jpg else "png"}'
        if full: pg.screenshot(path=str(path), omit_background=transparent, type='jpeg' if jpg else 'png', **({'quality': 90} if jpg else {}))
        else:
            box = pg.evaluate("""() => { const r = [...document.body.querySelectorAll('body > *')].filter(e => e.tagName !== 'STYLE').map(e => e.getBoundingClientRect());
              const x0 = Math.min(...r.map(a => a.left)), y0 = Math.min(...r.map(a => a.top)), x1 = Math.max(...r.map(a => a.right)), y1 = Math.max(...r.map(a => a.bottom));
              return { x: Math.max(0, x0 - 60), y: Math.max(0, y0 - 60), width: Math.min(2400, x1 + 60) - Math.max(0, x0 - 60), height: Math.min(1350, y1 + 60) - Math.max(0, y0 - 60) }; }""")
            pg.screenshot(path=str(path), omit_background=True, clip=box)
            b.close(); return box
        b.close(); return {'x': 0, 'y': 0, 'width': W, 'height': H}

# ---------- depth for the room (final polish) ----------
VP = (1200, 600)   # vanishing point
def floor_lines():
    ln = ''.join(f'<line x1="{VP[0]}" y1="{VP[1]}" x2="{x}" y2="1350" stroke="rgba(255,225,190,.045)" stroke-width="2"/>' for x in range(-2400, 4900, 300))
    hz = ''.join(f'<line x1="0" y1="{y}" x2="2400" y2="{y}" stroke="rgba(255,225,190,{.02 + i * .008:.3f})" stroke-width="2"/>' for i, y in enumerate([1166, 1186, 1214, 1252, 1302]))
    return f'<svg width="2400" height="1350" style="position:absolute;left:0;top:0"><defs><clipPath id="f"><rect x="0" y="1150" width="2400" height="200"/></clipPath></defs><g clip-path="url(#f)">{ln}{hz}</g></svg>'
SPOTS = [(360, 240, 520), (1210, 120, 760), (755, 470, 360), (1930, 170, 560), (1940, 930, 520)]
ROOM_DEPTH = ('<div style="position:absolute;inset:0;background:radial-gradient(1300px 900px at 50% 30%,#2e2324,#171112 65%,#0d0a0b);"></div>'
    '<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.016) 0 2px,transparent 2px 120px)"></div>'
    + ''.join(f'<div style="position:absolute;left:{x - r}px;top:{y - r * .25}px;width:{2 * r}px;height:{1.6 * r}px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,206,150,.16),rgba(255,206,150,0))"></div>' for x, y, r in SPOTS)
    + '<svg width="2400" height="1350" style="position:absolute;left:0;top:0">'
      '<polygon points="0,0 110,70 110,1150 0,1350" fill="rgba(0,0,0,.45)"/><polygon points="2400,0 2290,70 2290,1150 2400,1350" fill="rgba(0,0,0,.45)"/>'
      '<line x1="110" y1="70" x2="110" y2="1150" stroke="rgba(255,225,190,.06)" stroke-width="2"/><line x1="2290" y1="70" x2="2290" y2="1150" stroke="rgba(255,225,190,.06)" stroke-width="2"/></svg>'
    '<div style="position:absolute;left:0;right:0;top:1150px;bottom:0;background:linear-gradient(#211819,#0b0808)"></div>'
    + floor_lines() +
    '<div style="position:absolute;left:0;right:0;top:1149px;height:3px;background:rgba(255,220,180,.14)"></div>'
    + ''.join(f'<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.75),rgba(0,0,0,0))"></div>'
              for x, y, w, h in [(120, 1120, 480, 70), (620, 1135, 270, 46), (860, 1090, 700, 90), (1600, 1140, 680, 80)])
    + '<div style="position:absolute;inset:0;box-shadow:inset 0 0 260px 60px rgba(0,0,0,.65)"></div>')
ROOM_RUG = ('<div style="position:absolute;left:560px;top:1185px;width:1300px;height:150px;border-radius:50%;'
            'background:radial-gradient(closest-side,#5b3f3f,#3b2829 70%,rgba(40,28,28,0));opacity:.85"></div>')
FG = ('<div style="position:absolute;left:-150px;top:-60px;width:420px;height:820px;filter:blur(13px)">'
      '<div style="position:absolute;left:0;top:0;width:520px;height:22px;border-radius:11px;background:linear-gradient(#e7c792,#8b6a3b)"></div>'
      f'<img src="{CUT}/rose_wrap_dress.png" style="position:absolute;left:40px;top:40px;height:760px;filter:brightness(.3) drop-shadow(0 30px 40px rgba(0,0,0,.7))"></div>'
      '<div style="position:absolute;left:2010px;top:1225px;width:560px;height:260px;filter:blur(8px)">'
      '<div style="position:absolute;left:0;top:30px;width:560px;height:230px;border-radius:50% 50% 18px 18px / 60% 60% 18px 18px;background:radial-gradient(70% 80% at 45% 30%,#b8807c,#6e4442 70%,#3b2526)"></div>'
      '<div style="position:absolute;left:30px;top:0;width:500px;height:90px;border-radius:50%;background:radial-gradient(closest-side,#d29a95,#8a5653)"></div></div>')
def mirror_dark():
    return ('<div style="position:absolute;left:922px;top:152px;width:576px;height:936px;border-radius:290px 290px 10px 10px;'
            'background:linear-gradient(170deg,#1c1617,#0f0b0c 60%,#090707);box-shadow:inset 0 0 80px rgba(255,214,160,.10)"></div>')

if __name__ == '__main__' and 'depth' in __import__('sys').argv:
    pos = json.load(open(OUT / 'positions.json'))
    render('room_bg', ROOM_DEPTH, False, full=True, jpg=True)
    pos['room_rug'] = render('room_rug', ROOM_RUG)
    pos['room_fg'] = render('room_fg', FG, full=True)
    pos['mirror_dark'] = render('mirror_dark', mirror_dark())
    json.dump(pos, open(OUT / 'positions.json', 'w'), indent=1); print({k: pos[k] for k in ('room_rug', 'room_fg', 'mirror_dark')})
elif __name__ == '__main__':
    pos = {}
    for k, (html, transparent) in closet_parts().items():
        pos[k] = render(k, html) if k.startswith('door') else render(k, html, transparent, full=True, jpg=(k == 'open_room'))
    room = room_parts()
    render('room_bg', ROOM_WALL, False, full=True, jpg=True)
    for k, html in room.items(): pos[k] = render(k, html)
    pos['laptop_closed'] = render('laptop_closed', LAPTOP_CLOSED)
    json.dump(pos, open(OUT / 'positions.json', 'w'), indent=1)
    print(json.dumps(pos)[:500])
