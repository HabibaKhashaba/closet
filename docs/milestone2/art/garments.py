# Product-style garment illustrations for the Closet demo wardrobe.
# Each piece is drawn flat-lay on a warm studio background: soft shadow, fabric shading,
# seams and details. Output: SVG files (800 x 1000), rendered to JPG by render.py.
import math, os

OUT = os.path.join(os.path.dirname(__file__), 'svg')
os.makedirs(OUT, exist_ok=True)
BG = '#F3EEE8'

def shade(hex_, f):
    h = hex_.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    if f >= 1: r, g, b = (int(c + (255 - c) * (f - 1)) for c in (r, g, b))
    else: r, g, b = (int(c * f) for c in (r, g, b))
    return '#%02x%02x%02x' % (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))

class Art:
    def __init__(self, name):
        self.name = name; self.defs = []; self.body = []; self.n = 0
    def uid(self, p): self.n += 1; return f'{p}{self.n}'
    def grad(self, col, light=1.12, dark=0.84, angle=(0.2, 0, 0.8, 1)):
        g = self.uid('g'); x1, y1, x2, y2 = angle
        self.defs.append(f'<linearGradient id="{g}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{shade(col, light)}"/><stop offset="0.55" stop-color="{col}"/><stop offset="1" stop-color="{shade(col, dark)}"/></linearGradient>')
        return f'url(#{g})'
    def sheen(self):
        g = self.uid('s')
        self.defs.append(f'<linearGradient id="{g}" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>')
        return f'url(#{g})'
    def piece(self, d, col, *, outline=None, texture=None, sheen=False, sw=2.2, grad=True):
        """A garment part: soft shadow, gradient fill, optional texture and sheen, outline."""
        cid = self.uid('c')
        self.defs.append(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
        self.body.append(f'<path d="{d}" fill="#3a2c25" opacity="0.16" transform="translate(10 16)" filter="url(#blur)"/>')
        self.body.append(f'<path d="{d}" fill="{self.grad(col) if grad else col}"/>')
        if texture: self.body.append(f'<g clip-path="url(#{cid})">{texture}</g>')
        if sheen: self.body.append(f'<path d="{d}" fill="{self.sheen()}"/>')
        self.body.append(f'<path d="{d}" fill="none" stroke="{outline or shade(col, 0.72)}" stroke-width="{sw}" stroke-linejoin="round"/>')
        return cid
    def clip(self, cid, svg): self.body.append(f'<g clip-path="url(#{cid})">{svg}</g>')
    def add(self, svg): self.body.append(svg)
    def line(self, d, col, w=2, dash=None, op=1):
        da = f' stroke-dasharray="{dash}"' if dash else ''
        self.body.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" opacity="{op}"{da}/>')
    def button(self, x, y, r=9, col='#f4f1ec'):
        self.body.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}" stroke="{shade(col, 0.62)}" stroke-width="1.5"/>'
                         f'<circle cx="{x - r * .3}" cy="{y - r * .3}" r="{r * .35}" fill="#fff" opacity=".5"/>'
                         f'<circle cx="{x - r * .3}" cy="{y + r * .15}" r="1.3" fill="{shade(col, 0.5)}"/><circle cx="{x + r * .3}" cy="{y + r * .15}" r="1.3" fill="{shade(col, 0.5)}"/>')
    def fold(self, d, op=0.18): self.line(d, '#000', 3, op=op)
    def hl(self, d, op=0.35): self.line(d, '#fff', 3, op=op)
    def save(self):
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">'
               f'<defs><filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>'
               f'<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0"/></filter>'
               f'<radialGradient id="bg" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#FBF8F4"/><stop offset="1" stop-color="{BG}"/></radialGradient>'
               + ''.join(self.defs) + '</defs>'
               f'<rect width="800" height="1000" fill="url(#bg)"/>' + ''.join(self.body) + '</svg>')
        open(os.path.join(OUT, self.name + '.svg'), 'w').write(svg)

# ---------- textures ----------
def ribs(col, step=16, x0=0, x1=800, op=0.22):
    return ''.join(f'<line x1="{x}" y1="0" x2="{x}" y2="1000" stroke="{shade(col, 0.6)}" stroke-width="3" opacity="{op}"/><line x1="{x + 5}" y1="0" x2="{x + 5}" y2="1000" stroke="#fff" stroke-width="2" opacity="{op * .6}"/>' for x in range(x0, x1, step))
def stripes(col, y0=160, step=44, w=18):
    return ''.join(f'<rect x="0" y="{y}" width="800" height="{w}" fill="{col}"/>' for y in range(y0, 1000, step))
def knit(col):
    s = []
    for y in range(120, 1000, 22):
        for x in range(0, 800, 22):
            s.append(f'<path d="M{x} {y} l11 12 l11 -12" fill="none" stroke="{shade(col, 0.82)}" stroke-width="2.2" opacity="0.55"/>')
    return ''.join(s)
def denim(col):
    s = [f'<rect width="800" height="1000" filter="url(#grain)"/>']
    for i in range(-1000, 800, 9):
        s.append(f'<line x1="{i}" y1="0" x2="{i + 1000}" y2="1000" stroke="{shade(col, 1.18)}" stroke-width="1.2" opacity="0.25"/>')
    return ''.join(s)
def grain(): return '<rect width="800" height="1000" filter="url(#grain)"/>'
def fade(cx, cy, rx, ry, op=0.35):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fff" opacity="{op}" filter="url(#blur)"/>'

# ---------- silhouettes ----------
def tee_path(fit=0, sleeve_len=0):
    w = 18 * fit  # waist pull-in
    return (f'M318 176 C350 222 450 222 482 176 L566 204 C612 226 640 262 668 322 L604 360 C590 350 578 338 566 330 '
            f'C560 460 {566 - w} 600 572 812 C480 832 320 832 228 812 C{234 + w} 600 240 460 234 330 C222 338 210 350 196 360 '
            f'L132 322 C160 262 188 226 234 204 Z')
def longsleeve_path(fit=0):
    w = 20 * fit
    return (f'M322 178 C352 220 448 220 478 178 L566 206 C604 222 626 250 638 300 L690 742 L626 756 L572 372 '
            f'C566 470 {568 - w} 620 574 812 C480 830 320 830 226 812 C{232 + w} 620 234 470 228 372 L174 756 L110 742 L162 300 '
            f'C174 250 196 222 234 206 Z')

def tee(name, col, fit=1, stripe=None, rib=False, neck='crew', label=False):
    a = Art(name)
    tex = (stripes(stripe) if stripe else '') + (ribs(col) if rib else '') + grain()
    cid = a.piece(tee_path(fit), col, texture=tex)
    # neckband
    a.add(f'<path d="M318 176 C350 222 450 222 482 176 C472 196 446 208 400 208 C354 208 328 196 318 176 Z" fill="{shade(col, 0.9)}" stroke="{shade(col, 0.7)}" stroke-width="1.6"/>')
    a.line('M330 186 C360 222 440 222 470 186', shade(col, 0.66), 1.5, '5 5', 0.8)
    a.line('M604 360 C590 350 578 338 566 330', shade(col, 0.6), 1.6)
    a.line('M196 360 C210 350 222 338 234 330', shade(col, 0.6), 1.6)
    a.line('M622 349 L192 349', shade(col, 0.7), 1, '0', 0)  # noop
    a.line('M238 790 C320 808 480 808 562 790', shade(col, 0.66), 1.4, '5 5', 0.8)
    a.fold('M300 420 C330 520 320 640 330 760', 0.06); a.fold('M500 430 C470 560 480 660 470 770', 0.07)
    a.hl('M262 300 C300 360 300 500 290 640', 0.18)
    a.save()

def longsleeve(name, col, rib=False, fit=1, turtle=False):
    a = Art(name)
    tex = (ribs(col, 14) if rib else '') + grain()
    a.piece(longsleeve_path(fit), col, texture=tex)
    a.add(f'<path d="M322 178 C352 220 448 220 478 178 C468 198 444 210 400 210 C356 210 332 198 322 178 Z" fill="{shade(col, 0.88)}" stroke="{shade(col, 0.7)}" stroke-width="1.6"/>')
    a.line('M176 742 L112 730', shade(col, 0.6), 1.6); a.line('M624 744 L688 730', shade(col, 0.6), 1.6)
    a.fold('M300 420 C330 520 320 640 330 760', 0.06); a.fold('M500 430 C470 560 480 660 470 770', 0.07)
    a.hl('M262 310 C300 360 300 500 290 640', 0.15)
    a.save()

def oxford(name, col):
    a = Art(name)
    body = ('M330 170 L470 170 L566 200 C606 216 628 246 640 296 L694 736 L630 752 L574 366 '
            'C570 480 572 640 580 790 C540 836 460 846 400 832 C340 846 260 836 220 790 C228 640 230 480 226 366 L170 752 L106 736 L160 296 C172 246 194 216 234 200 Z')
    stripes_tex = ''.join(f'<line x1="{x}" y1="0" x2="{x}" y2="1000" stroke="#fff" stroke-width="2" opacity="0.18"/>' for x in range(0, 800, 9))
    a.piece(body, col, texture=stripes_tex + grain())
    # collar
    a.add(f'<path d="M330 170 C350 150 450 150 470 170 L452 232 L400 206 L348 232 Z" fill="{shade(col, 1.05)}" stroke="{shade(col, .68)}" stroke-width="2"/>')
    a.add(f'<path d="M400 206 L348 232 L326 196 L338 172 Z" fill="{shade(col, 1.1)}" stroke="{shade(col, .68)}" stroke-width="2"/>')
    a.add(f'<path d="M400 206 L452 232 L474 196 L462 172 Z" fill="{shade(col, 1.0)}" stroke="{shade(col, .68)}" stroke-width="2"/>')
    # placket + buttons
    a.line('M388 214 L388 834', shade(col, .7), 1.6); a.line('M412 214 L412 834', shade(col, .7), 1.6)
    for y in range(262, 820, 92): a.button(400, y, 7, '#f6f3ee')
    # pocket
    a.add(f'<path d="M454 330 L530 330 L530 410 L492 424 L454 410 Z" fill="none" stroke="{shade(col, .66)}" stroke-width="1.8"/>')
    # cuffs
    a.add(f'<path d="M176 700 L110 688 L106 736 L170 752 Z" fill="{shade(col, .95)}" stroke="{shade(col, .66)}" stroke-width="1.8"/>')
    a.add(f'<path d="M624 702 L690 688 L694 736 L630 752 Z" fill="{shade(col, .95)}" stroke="{shade(col, .66)}" stroke-width="1.8"/>')
    a.fold('M300 420 C320 540 310 660 316 790', 0.07); a.fold('M500 430 C484 560 490 680 484 800', 0.07)
    a.line('M226 366 C200 300 210 250 234 200', shade(col, .7), 1.4, '4 5', .7); a.line('M574 366 C600 300 590 250 566 200', shade(col, .7), 1.4, '4 5', .7)
    a.save()

def sweater(name, col):
    a = Art(name)
    body = ('M318 172 C350 214 450 214 482 172 L576 200 C624 220 650 256 664 312 L716 716 L644 736 L594 400 '
            'C600 540 600 660 602 760 L198 760 C200 660 200 540 206 400 L156 736 L84 716 L136 312 C150 256 176 220 224 200 Z')
    a.piece(body, col, texture=knit(col) + grain(), sw=2)
    # rib collar, cuffs, hem
    a.add(f'<path d="M318 172 C350 214 450 214 482 172 C474 202 446 222 400 222 C354 222 326 202 318 172 Z" fill="{shade(col, .94)}" stroke="{shade(col, .72)}" stroke-width="1.6"/>')
    hem = 'M198 760 L602 760 L604 818 C500 830 300 830 196 818 Z'
    cid = a.uid('c'); a.defs.append(f'<clipPath id="{cid}"><path d="{hem}"/></clipPath>')
    a.add(f'<path d="{hem}" fill="{shade(col, .93)}" stroke="{shade(col, .72)}" stroke-width="1.6"/>'); a.clip(cid, ribs(col, 12, op=.35))
    for c in ['M84 716 L156 736 L150 790 L74 770 Z', 'M716 716 L644 736 L650 790 L726 770 Z']:
        k = a.uid('c'); a.defs.append(f'<clipPath id="{k}"><path d="{c}"/></clipPath>')
        a.add(f'<path d="{c}" fill="{shade(col, .93)}" stroke="{shade(col, .72)}" stroke-width="1.6"/>'); a.clip(k, ribs(col, 10, op=.35))
    a.fold('M290 420 C318 540 306 640 312 740', 0.06); a.fold('M512 420 C490 540 500 640 494 740', 0.06)
    a.save()

def blouse(name, col):
    a = Art(name)
    body = ('M334 178 C360 250 440 250 466 178 L556 200 C604 216 632 250 646 300 L700 690 C676 712 640 720 610 706 L578 380 '
            'C576 500 586 640 600 790 C500 820 300 820 200 790 C214 640 224 500 222 380 L190 706 C160 720 124 712 100 690 L154 300 C168 250 196 216 244 200 Z')
    a.piece(body, col, sheen=True, texture=grain())
    a.add(f'<path d="M334 178 C360 250 440 250 466 178 L452 176 C432 232 368 232 348 176 Z" fill="{shade(col, .9)}"/>')
    # tie bow at neck
    a.add(f'<path d="M400 246 C380 236 352 240 346 256 C352 272 384 270 400 256 C416 270 448 272 454 256 C448 240 420 236 400 246 Z" fill="{shade(col, .95)}" stroke="{shade(col, .7)}" stroke-width="1.6"/>')
    a.add(f'<path d="M392 258 L366 352 L384 356 L400 270 L416 356 L434 352 L408 258 Z" fill="{shade(col, .92)}" stroke="{shade(col, .7)}" stroke-width="1.6"/>')
    a.fold('M280 420 C310 540 300 660 300 780', 0.08); a.fold('M520 420 C494 540 504 660 500 780', 0.08); a.fold('M400 380 C392 520 408 640 400 800', 0.05)
    a.hl('M250 330 C280 420 276 560 262 700', 0.3)
    a.save()

def cami(name, col):
    a = Art(name)
    body = 'M300 300 C340 290 370 300 400 314 C430 300 460 290 500 300 C520 420 540 560 560 790 C470 812 330 812 240 790 C260 560 280 420 300 300 Z'
    a.piece(body, col, sheen=True, texture=grain())
    a.line('M312 300 L330 150', shade(col, .7), 4); a.line('M488 300 L470 150', shade(col, .7), 4)
    a.add(f'<path d="M300 300 C340 290 370 300 400 314 C430 300 460 290 500 300 L496 324 C460 316 430 324 400 338 C370 324 340 316 304 324 Z" fill="{shade(col, .86)}"/>')
    a.fold('M330 420 C350 560 340 680 344 780', .08); a.fold('M470 420 C452 560 462 680 456 780', .08)
    a.save()

def trousers(name, col, wide=False, jeans=False, crease=True):
    a = Art(name)
    if wide:
        d = 'M262 150 L538 150 L560 360 C590 520 616 700 640 900 L448 910 L404 360 L396 360 L352 910 L160 900 C184 700 210 520 240 360 Z'
    else:
        d = 'M270 150 L530 150 L552 360 C560 520 568 700 574 900 L432 908 L404 380 L396 380 L368 908 L226 900 C232 700 240 520 248 360 Z'
    tex = (denim(col) + fade(340, 560, 50, 200, .28) + fade(470, 560, 50, 200, .28)) if jeans else grain()
    a.piece(d, col, texture=tex)
    a.add(f'<path d="M262 150 L538 150 L541 190 L259 190 Z" fill="{shade(col, .9)}" stroke="{shade(col, .66)}" stroke-width="1.8"/>' if wide else
          f'<path d="M270 150 L530 150 L533 190 L267 190 Z" fill="{shade(col, .9)}" stroke="{shade(col, .66)}" stroke-width="1.8"/>')
    st = '#d59b52' if jeans else shade(col, .62)
    a.line('M400 190 L400 330 C398 356 386 368 372 372', st, 2, '6 5' if jeans else None, .9)
    for x in ([300, 360, 440, 500]): a.add(f'<rect x="{x - 5}" y="146" width="10" height="50" rx="3" fill="{shade(col, .82)}" stroke="{shade(col, .6)}" stroke-width="1.2"/>')
    a.button(400, 170, 7, '#c9a46a' if jeans else shade(col, .8))
    a.line('M282 196 C300 250 334 268 366 270' if not wide else 'M276 196 C296 250 330 268 362 270', st, 2, '6 5' if jeans else None, .8)
    a.line('M518 196 C500 250 466 268 434 270' if not wide else 'M524 196 C504 250 470 268 438 270', st, 2, '6 5' if jeans else None, .8)
    if jeans:
        a.line('M232 880 L372 888', st, 2, '6 5', .8); a.line('M428 888 L568 880', st, 2, '6 5', .8)
        a.line('M262 330 C300 600 300 760 296 900', '#fff', 3, op=.12)
    elif crease:
        a.line('M318 240 C316 500 300 720 264 900' if wide else 'M322 240 C318 500 304 720 298 900', shade(col, .78), 2, op=.7)
        a.line('M482 240 C484 500 500 720 536 900' if wide else 'M478 240 C482 500 496 720 502 900', shade(col, .78), 2, op=.7)
    a.fold('M396 380 C390 500 382 640 370 880', .1)
    a.save()

def skirt(name, col, pleated=False, midi=False):
    a = Art(name)
    bottom = 900 if midi else 780
    d = f'M290 180 L510 180 C560 380 600 600 {640 if midi else 620} {bottom} C500 {bottom + 26} 300 {bottom + 26} {160 if midi else 180} {bottom} C200 600 240 380 290 180 Z'
    a.piece(d, col, texture=grain(), sheen=not pleated)
    a.add(f'<path d="M290 180 L510 180 L514 226 L286 226 Z" fill="{shade(col, .9)}" stroke="{shade(col, .66)}" stroke-width="1.8"/>')
    if pleated:
        for i in range(-4, 5):
            x0 = 400 + i * 24; x1 = 400 + i * (60 if midi else 52)
            a.line(f'M{x0} 226 L{x1} {bottom + 16}', shade(col, .7), 2, op=.55); a.line(f'M{x0 + 8} 226 L{x1 + 14} {bottom + 16}', '#fff', 2, op=.25)
    else:
        a.fold(f'M360 300 C350 500 330 700 300 {bottom}', .1); a.fold(f'M450 300 C462 500 480 700 510 {bottom}', .1)
    a.save()

def midi_dress(name, col):
    a = Art(name)
    d = ('M344 140 L372 140 L400 262 L428 140 L456 140 C500 154 548 170 572 196 L622 318 L560 344 L536 290 C530 360 520 400 500 430 '
         'C560 560 620 740 660 930 C520 962 280 962 140 930 C180 740 240 560 300 430 C280 400 270 360 264 290 L240 344 L178 318 L228 196 C252 170 300 154 344 140 Z')
    a.piece(d, col, sheen=True, texture=grain())
    # waist tie
    a.add(f'<path d="M296 424 C360 440 440 440 504 424 L500 456 C440 470 360 470 300 456 Z" fill="{shade(col, .86)}" stroke="{shade(col, .66)}" stroke-width="1.6"/>')
    a.add(f'<path d="M420 452 C430 520 420 600 404 650 L424 656 C444 600 452 520 440 452 Z" fill="{shade(col, .9)}" stroke="{shade(col, .66)}" stroke-width="1.4"/>')
    a.line('M344 140 L400 262 L456 140', shade(col, .62), 2)
    for x0, x1 in [(330, 220), (380, 340), (430, 470), (470, 580)]: a.fold(f'M{x0} 470 C{(x0 + x1) / 2} 700 {x1} 820 {x1} 940', .12)
    a.hl('M300 480 C270 620 240 760 210 920', .3); a.hl('M520 500 C548 640 580 780 606 920', .2)
    a.save()

def blazer(name, col):
    a = Art(name)
    body = ('M320 150 L480 150 L578 182 C620 198 646 232 656 290 L708 760 L636 778 L592 392 C596 560 600 700 604 830 '
            'C520 850 470 852 400 846 C330 852 280 850 196 830 C200 700 204 560 208 392 L164 778 L92 760 L144 290 C154 232 180 198 222 182 Z')
    a.piece(body, col, texture=grain())
    # lapels
    a.add(f'<path d="M320 150 L400 520 L346 470 L300 300 L332 268 L292 230 Z" fill="{shade(col, 1.08)}" stroke="{shade(col, .6)}" stroke-width="2"/>')
    a.add(f'<path d="M480 150 L400 520 L454 470 L500 300 L468 268 L508 230 Z" fill="{shade(col, .96)}" stroke="{shade(col, .6)}" stroke-width="2"/>')
    a.add(f'<path d="M352 150 L400 300 L448 150 Z" fill="#f2ece4" stroke="{shade(col, .6)}" stroke-width="1.6"/>')
    a.line('M400 520 L400 846', shade(col, .6), 1.8)
    a.button(414, 580, 10, shade(col, .75)); a.button(414, 680, 10, shade(col, .75))
    a.add(f'<rect x="246" y="640" width="110" height="18" rx="4" fill="{shade(col, .9)}" stroke="{shade(col, .6)}" stroke-width="1.5"/>')
    a.add(f'<rect x="444" y="640" width="110" height="18" rx="4" fill="{shade(col, .9)}" stroke="{shade(col, .6)}" stroke-width="1.5"/>')
    a.line('M470 400 L540 392', shade(col, .6), 1.8)
    a.fold('M260 420 C270 560 262 700 262 820', .08); a.fold('M540 420 C530 560 538 700 538 820', .08)
    a.hl('M190 320 C200 500 196 640 200 800', .14)
    a.save()

def trench(name, col):
    a = Art(name)
    body = ('M316 140 L484 140 L584 172 C626 188 652 222 662 280 L712 740 L640 758 L598 380 C604 600 616 800 640 948 '
            'C520 968 470 970 400 964 C330 970 280 968 160 948 C184 800 196 600 202 380 L160 758 L88 740 L138 280 C148 222 174 188 216 172 Z')
    a.piece(body, col, texture=grain())
    a.add(f'<path d="M316 140 L400 440 L330 420 L290 270 L322 240 L280 200 Z" fill="{shade(col, 1.07)}" stroke="{shade(col, .62)}" stroke-width="2"/>')
    a.add(f'<path d="M484 140 L400 440 L470 420 L510 270 L478 240 L520 200 Z" fill="{shade(col, .96)}" stroke="{shade(col, .62)}" stroke-width="2"/>')
    # belt
    a.add(f'<path d="M198 520 L602 520 L604 562 L196 562 Z" fill="{shade(col, .9)}" stroke="{shade(col, .6)}" stroke-width="1.8"/>')
    a.add(f'<rect x="372" y="514" width="56" height="54" rx="6" fill="none" stroke="#9b7b4e" stroke-width="5"/><line x1="400" y1="514" x2="400" y2="568" stroke="#9b7b4e" stroke-width="4"/>')
    a.add(f'<path d="M428 562 C440 640 430 700 420 740 L440 744 C452 700 462 640 450 562 Z" fill="{shade(col, .9)}" stroke="{shade(col, .6)}" stroke-width="1.4"/>')
    for x in (350, 450):
        for y in (300, 400, 640, 740): a.button(x, y, 9, shade(col, .55))
    a.add(f'<path d="M228 182 L300 166 L306 196 L234 210 Z" fill="{shade(col, .92)}" stroke="{shade(col, .6)}" stroke-width="1.5"/>')
    a.add(f'<path d="M572 182 L500 166 L494 196 L566 210 Z" fill="{shade(col, .92)}" stroke="{shade(col, .6)}" stroke-width="1.5"/>')
    a.line('M400 440 L400 964', shade(col, .62), 1.6)
    a.fold('M260 600 C250 740 230 860 214 944', .1); a.fold('M540 600 C550 740 570 860 586 944', .1)
    a.save()

def denim_jacket(name, col):
    a = Art(name)
    body = ('M326 156 L474 156 L570 186 C612 202 638 236 648 292 L700 720 L628 738 L586 384 C588 500 590 600 590 700 '
            'L210 700 C210 600 212 500 214 384 L172 738 L100 720 L152 292 C162 236 188 202 230 186 Z')
    a.piece(body, col, texture=denim(col) + fade(400, 420, 160, 120, .2))
    a.add(f'<path d="M326 156 C350 140 450 140 474 156 L456 226 L400 200 L344 226 Z" fill="{shade(col, 1.04)}" stroke="{shade(col, .62)}" stroke-width="2"/>')
    st = '#d59b52'
    a.line('M400 200 L400 700', st, 2, '6 5'); a.line('M386 210 L386 700', shade(col, .62), 1.6)
    for y in (250, 340, 430, 520, 610): a.button(412, y, 8, '#c49a5f')
    for x0 in (250, 450):
        a.add(f'<path d="M{x0} 300 L{x0 + 100} 300 L{x0 + 100} 332 L{x0 + 50} 344 L{x0} 332 Z" fill="{shade(col, .94)}" stroke="{shade(col, .6)}" stroke-width="1.6"/>')
        a.line(f'M{x0 + 6} 326 L{x0 + 94} 326', st, 1.6, '5 4')
        a.line(f'M{x0} 360 L{x0 + 100} 360 L{x0 + 100} 440 L{x0} 440 Z', st, 1.6, '5 4', .8)
    a.add(f'<path d="M210 650 L590 650 L590 700 L210 700 Z" fill="{shade(col, .93)}" stroke="{shade(col, .6)}" stroke-width="1.6"/>')
    a.line('M214 676 L586 676', st, 1.6, '5 4')
    a.save()

def cardigan(name, col):
    a = Art(name)
    body = ('M330 160 L470 160 L572 192 C618 210 644 244 656 300 L708 730 L638 748 L590 392 C594 540 596 660 600 800 '
            'L200 800 C204 660 206 540 210 392 L162 748 L92 730 L144 300 C156 244 182 210 228 192 Z')
    a.piece(body, col, texture=knit(col) + grain())
    a.add(f'<path d="M330 160 L400 500 L470 160 L452 160 L400 440 L348 160 Z" fill="#f1ebe3" stroke="{shade(col, .7)}" stroke-width="1.6"/>')
    a.line('M330 160 L400 500 L400 800', shade(col, .68), 2); a.line('M470 160 L400 500', shade(col, .68), 2)
    for y in (540, 620, 700): a.button(412, y, 8, '#efe7da')
    a.save()

# ---------- shoes, bags, accessories ----------

def pair(a, draw, front=(70, 560), back=(190, 420), s=1.3):
    """Two shoes: the back one slightly up-right and darker, like a product shot of a pair."""
    draw(a, back[0], back[1], s, 0.93)
    draw(a, front[0], front[1], s, 1.0)

def _t(x, y, s):
    return lambda px, py: f'{x + px * s:.1f} {y + py * s:.1f}'

def sneakers(name, col, accent='#cfc8bc'):
    a = Art(name)
    def one(a, x, y, s, k):
        t = _t(x, y, s); c = shade(col, k)
        up = (f'M{t(14, 150)} C{t(10, 120)} {t(12, 90)} {t(30, 70)} C{t(44, 56)} {t(70, 56)} {t(92, 66)} C{t(112, 76)} {t(132, 78)} {t(152, 70)} '
              f'L{t(176, 44)} C{t(186, 36)} {t(200, 38)} {t(206, 48)} L{t(214, 62)} C{t(262, 88)} {t(330, 104)} {t(378, 112)} C{t(404, 116)} {t(418, 130)} {t(416, 148)} Z')
        a.piece(up, c, texture=grain())
        a.add(f'<path d="M{t(330, 108)} C{t(370, 112)} {t(404, 118)} {t(414, 140)} L{t(414, 150)} L{t(318, 150)} C{t(320, 132)} {t(324, 118)} {t(330, 108)} Z" fill="{shade(c, .95)}" stroke="{shade(c, .72)}" stroke-width="1.5"/>')
        a.add(f'<path d="M{t(14, 150)} C{t(12, 120)} {t(14, 96)} {t(26, 78)} L{t(54, 82)} C{t(50, 104)} {t(52, 130)} {t(58, 150)} Z" fill="{shade(c, .9)}" stroke="{shade(c, .72)}" stroke-width="1.5"/>')
        a.piece(f'M{t(6, 146)} L{t(420, 146)} C{t(424, 162)} {t(414, 178)} {t(394, 178)} L{t(22, 178)} C{t(8, 178)} {t(2, 162)} {t(6, 146)} Z', '#fbfaf7', outline='#cfc7ba')
        a.line(f'M{t(10, 160)} L{t(418, 160)}', '#ddd5c8', 2)
        for i in range(6):
            px, py = 182 + i * 22, 62 + i * 8
            a.line(f'M{t(px - 6, py - 4)} L{t(px + 12, py + 14)}', '#b9b1a4', 4.5)
            a.add(f'<circle cx="{x + (px - 8) * s:.1f}" cy="{y + (py + 6) * s:.1f}" r="{2.6 * s:.1f}" fill="{shade(c, .7)}"/>')
        a.line(f'M{t(70, 124)} C{t(130, 110)} {t(200, 108)} {t(270, 124)}', accent, 5 * s, op=.9)
        a.line(f'M{t(60, 76)} C{t(110, 90)} {t(150, 86)} {t(172, 60)}', shade(c, .7), 1.5, '4 4')
    pair(a, one)
    a.save()

def loafers(name, col):
    a = Art(name)
    def one(a, x, y, s, k):
        t = _t(x, y, s); c = shade(col, k)
        up = (f'M{t(10, 132)} C{t(10, 104)} {t(30, 88)} {t(70, 86)} L{t(150, 84)} C{t(190, 82)} {t(220, 76)} {t(250, 80)} '
              f'C{t(320, 88)} {t(380, 104)} {t(404, 122)} C{t(416, 130)} {t(414, 142)} {t(404, 146)} L{t(12, 146)} Z')
        a.piece(up, c, sheen=True)
        a.add(f'<path d="M{t(206, 84)} C{t(260, 78)} {t(330, 92)} {t(372, 112)} C{t(340, 128)} {t(270, 130)} {t(206, 122)} Z" fill="{shade(c, .9)}" stroke="{shade(c, .55)}" stroke-width="1.6"/>')
        a.line(f'M{t(212, 90)} C{t(262, 86)} {t(322, 98)} {t(360, 113)}', shade(c, 1.6), 1.4, '4 4', .7)
        a.add(f'<path d="M{t(190, 96)} L{t(290, 100)} L{t(286, 118)} L{t(188, 114)} Z" fill="{shade(c, .8)}" stroke="{shade(c, .5)}" stroke-width="1.4"/>')
        a.add(f'<rect x="{x + 226 * s:.1f}" y="{y + 101 * s:.1f}" width="{26 * s:.1f}" height="{10 * s:.1f}" rx="4" fill="#cfa962"/>')
        a.add(f'<path d="M{t(30, 100)} C{t(70, 92)} {t(150, 90)} {t(200, 88)}" fill="none" stroke="#e8e0d4" stroke-width="{6 * s:.1f}" opacity=".55"/>')
        a.piece(f'M{t(8, 144)} L{t(410, 144)} L{t(404, 156)} L{t(10, 156)} Z', shade(c, .62), outline=shade(c, .45))
        a.piece(f'M{t(10, 154)} L{t(80, 154)} L{t(80, 170)} L{t(14, 170)} Z', shade(c, .55), outline=shade(c, .4))
    pair(a, one, front=(60, 600), back=(180, 470))
    a.save()

def heels(name, col):
    a = Art(name)
    def one(a, x, y, s, k):
        t = _t(x, y, s); c = shade(col, k)
        a.piece(f'M{t(28, 134)} L{t(56, 140)} L{t(48, 264)} L{t(38, 264)} Z', shade(c, .85))
        up = (f'M{t(30, 70)} C{t(40, 58)} {t(62, 60)} {t(72, 74)} C{t(112, 112)} {t(172, 130)} {t(250, 132)} C{t(320, 134)} {t(380, 140)} {t(408, 168)} '
              f'C{t(422, 176)} {t(420, 190)} {t(402, 192)} L{t(200, 192)} C{t(150, 192)} {t(100, 172)} {t(58, 142)} L{t(30, 140)} C{t(18, 120)} {t(20, 86)} {t(30, 70)} Z')
        a.piece(up, c, sheen=True)
        a.add(f'<path d="M{t(34, 74)} C{t(80, 108)} {t(140, 130)} {t(210, 136)} L{t(206, 146)} C{t(140, 160)} {t(80, 132)} {t(36, 100)} Z" fill="#f1e2d3"/>')
        a.line(f'M{t(200, 192)} L{t(404, 190)}', shade(c, .55), 2.2)
    pair(a, one, front=(70, 470), back=(190, 330))
    a.save()

def boots(name, col):
    a = Art(name)
    def one(a, x, y, s, k):
        t = _t(x, y, s); c = shade(col, k)
        up = f'M{t(30, 10)} L{t(170, 10)} C{t(176, 80)} {t(178, 130)} {t(184, 160)} C{t(250, 176)} {t(330, 190)} {t(370, 214)} C{t(394, 228)} {t(392, 256)} {t(366, 258)} L{t(20, 258)} C{t(14, 200)} {t(16, 100)} {t(30, 10)} Z'
        a.piece(up, c, sheen=True)
        a.add(f'<path d="M{t(100, 14)} C{t(96, 60)} {t(98, 120)} {t(108, 168)} L{t(150, 168)} C{t(140, 120)} {t(138, 60)} {t(142, 14)} Z" fill="{shade(c, .78)}" stroke="{shade(c, .55)}" stroke-width="1.5"/>')
        a.add(f'<path d="M{t(30, 10)} L{t(170, 10)} L{t(170, 24)} L{t(30, 24)} Z" fill="{shade(c, .85)}"/>')
        a.add(f'<path d="M{t(16, 0)} L{t(36, 0)} L{t(36, 40)} L{t(18, 40)} Z" fill="{shade(c, .7)}"/>')
        a.piece(f'M{t(14, 252)} L{t(374, 252)} L{t(368, 272)} L{t(84, 272)} L{t(82, 294)} L{t(16, 294)} Z', shade(c, .5), outline=shade(c, .35))
    pair(a, one, front=(120, 470), back=(250, 330), s=1.25)
    a.save()

def sandals(name, col):
    a = Art(name)
    foot = lambda cx, cy, s: (f'M{cx} {cy + 470 * s} C{cx - 70 * s} {cy + 470 * s} {cx - 90 * s} {cy + 400 * s} {cx - 86 * s} {cy + 330 * s} '
                              f'C{cx - 82 * s} {cy + 250 * s} {cx - 96 * s} {cy + 160 * s} {cx - 80 * s} {cy + 90 * s} C{cx - 66 * s} {cy + 30 * s} {cx - 30 * s} {cy} {cx + 10 * s} {cy} '
                              f'C{cx + 60 * s} {cy} {cx + 92 * s} {cy + 40 * s} {cx + 96 * s} {cy + 110 * s} C{cx + 100 * s} {cy + 200 * s} {cx + 84 * s} {cy + 260 * s} {cx + 80 * s} {cy + 330 * s} '
                              f'C{cx + 76 * s} {cy + 410 * s} {cx + 70 * s} {cy + 470 * s} {cx} {cy + 470 * s} Z')
    for cx, flip in ((290, -1), (510, 1)):
        s = 1.25; cy = 200
        a.piece(foot(cx, cy, s), '#efe3d2', outline=shade(col, .7))
        a.add(f'<path d="{foot(cx, cy, s)}" fill="none" stroke="{shade(col, .9)}" stroke-width="10" opacity=".5"/>')
        for yy, h in ((150, 70), (330, 60)):
            y0 = cy + yy * s
            d = f'M{cx - 118} {y0} C{cx - 60} {y0 - 26} {cx + 60} {y0 - 26} {cx + 118} {y0} L{cx + 116} {y0 + h} C{cx + 60} {y0 + h - 22} {cx - 60} {y0 + h - 22} {cx - 116} {y0 + h} Z'
            a.piece(d, col, sheen=True)
            a.line(f'M{cx - 108} {y0 + 10} C{cx - 60} {y0 - 12} {cx + 60} {y0 - 12} {cx + 108} {y0 + 10}', shade(col, 1.4), 1.5, '4 4', .8)
        a.add(f'<rect x="{cx + flip * 86 - 14}" y="{cy + 340 * s}" width="28" height="34" rx="5" fill="none" stroke="#c7a15c" stroke-width="5"/>')
    a.save()

def bag(name, col, tote=False):
    a = Art(name)
    if tote:
        for dx, op in ((0, 1), (24, .55)):
            a.add(f'<path d="M{300 + dx} 400 C{300 + dx} 230 {500 + dx} 230 {500 + dx} 400" fill="none" stroke="{shade(col, .78 if op == 1 else .6)}" stroke-width="22" stroke-linecap="round" opacity="{op}"/>')
        a.piece('M190 390 L610 390 L650 840 C540 862 260 862 150 840 Z', col, texture=grain(), sheen=True)
        a.add(f'<path d="M190 390 L610 390 L614 440 L186 440 Z" fill="{shade(col, .9)}" stroke="{shade(col, .6)}" stroke-width="1.8"/>')
        a.line('M196 452 L604 452', shade(col, 1.3), 1.8, '6 6', .8); a.line('M164 820 C260 840 540 840 636 820', shade(col, 1.3), 1.8, '6 6', .7)
        a.add(f'<rect x="420" y="470" width="70" height="40" rx="6" fill="{shade(col, .75)}" stroke="{shade(col, .55)}" stroke-width="1.5"/><circle cx="436" cy="490" r="5" fill="#d4af6a"/>')
        a.fold('M250 470 C240 600 228 720 220 830', .1); a.fold('M560 470 C570 600 582 720 590 830', .1)
    else:
        a.add(f'<path d="M320 420 C320 300 480 300 480 420" fill="none" stroke="{shade(col, .9)}" stroke-width="22" stroke-linecap="round"/><path d="M320 420 C320 300 480 300 480 420" fill="none" stroke="#fff" stroke-width="3" opacity=".25"/>')
        a.piece('M190 430 C190 410 206 400 226 400 L574 400 C594 400 610 410 610 430 L630 780 C630 800 614 812 594 812 L206 812 C186 812 170 800 170 780 Z', col, sheen=True)
        a.add(f'<path d="M190 430 C190 410 206 400 226 400 L574 400 C594 400 610 410 610 430 L616 560 C520 600 280 600 184 560 Z" fill="{shade(col, 1.06)}" stroke="{shade(col, .55)}" stroke-width="2"/>')
        a.add('<rect x="374" y="560" width="52" height="44" rx="8" fill="#d4af6a" stroke="#a8833f" stroke-width="2"/><rect x="388" y="574" width="24" height="16" rx="3" fill="#b8924c"/>')
        a.line('M206 794 L594 794', shade(col, 1.6), 1.6, '5 5', .6)
    a.save()

def scarf(name):
    a = Art(name)
    d = 'M400 170 L740 520 L400 870 L60 520 Z'
    pat = ''.join(f'<g transform="translate({x} {y}) rotate(45)"><circle r="22" fill="none" stroke="#c6a15b" stroke-width="5"/><circle r="7" fill="#e9dcc8"/></g>' for x in range(60, 760, 84) for y in range(170, 880, 84))
    pat += ''.join(f'<path d="M{x} {y} l14 14 l-14 14 l-14 -14 Z" fill="#a83b45" opacity=".85"/>' for x in range(102, 760, 84) for y in range(198, 880, 84))
    a.piece(d, '#26395c', sheen=True, texture=pat)
    a.add('<path d="M400 170 L740 520 L400 870 L60 520 Z M400 222 L688 520 L400 818 L112 520 Z" fill="#d8b46c" fill-rule="evenodd"/>')
    a.add('<path d="M400 236 L674 520 L400 804 L126 520 Z" fill="none" stroke="#f1e4cf" stroke-width="3"/>')
    a.fold('M240 380 C320 480 330 600 300 690', .14); a.fold('M560 340 C520 460 540 600 600 690', .12)
    a.save()

def earrings(name):
    a = Art(name)
    for cx in (270, 530):
        a.add(f'<circle cx="{cx + 12}" cy="{560 + 18}" r="140" fill="none" stroke="#3a2c25" stroke-width="26" opacity=".12" filter="url(#blur)"/>')
        g = a.grad('#d2a95c', 1.4, .66, (0, 0, 1, 1))
        a.add(f'<circle cx="{cx}" cy="560" r="140" fill="none" stroke="{g}" stroke-width="22"/>')
        a.add(f'<path d="M{cx - 99} {560 - 99} A140 140 0 0 1 {cx + 50} 429" fill="none" stroke="#fff6dd" stroke-width="6" opacity=".75"/>')
        a.add(f'<circle cx="{cx}" cy="420" r="14" fill="#c9a05a" stroke="#9c7a3e" stroke-width="2"/>')
    a.save()

def sunglasses(name):
    a = Art(name)
    tort = ''.join(f'<ellipse cx="{(i * 97) % 800}" cy="{(i * 61) % 1000}" rx="{20 + i % 13}" ry="{12 + i % 7}" fill="#3b2316" opacity=".5"/>' for i in range(160))
    a.line('M120 470 L60 430', '#6b4428', 16); a.line('M680 470 L740 430', '#6b4428', 16)
    for cx in (268, 532):
        a.piece(f'M{cx - 140} 470 C{cx - 140} 400 {cx + 140} 400 {cx + 140} 470 C{cx + 140} 600 {cx + 84} 640 {cx} 640 C{cx - 84} 640 {cx - 140} 600 {cx - 140} 470 Z', '#8a5a36', texture=tort, outline='#4a2d1b', sw=3)
        a.add(f'<path d="M{cx - 114} 476 C{cx - 114} 426 {cx + 114} 426 {cx + 114} 476 C{cx + 114} 580 {cx + 70} 614 {cx} 614 C{cx - 70} 614 {cx - 114} 580 {cx - 114} 476 Z" fill="#2c2420" opacity=".9"/>')
        a.add(f'<path d="M{cx - 86} 470 C{cx - 56} 446 {cx} 444 {cx + 30} 452" fill="none" stroke="#fff" stroke-width="8" opacity=".22"/>')
    a.add('<path d="M372 468 C388 440 412 440 428 468" fill="none" stroke="#6b4428" stroke-width="16"/>')
    a.save()

# ---------- the curated demo wardrobe ----------
ITEMS = [
    lambda: tee('white_fitted_tee', '#f7f4ef', fit=1.2),
    lambda: longsleeve('black_ribbed_top', '#26242a', rib=True, fit=1.3),
    lambda: oxford('blue_oxford_shirt', '#9db8d9'),
    lambda: sweater('cream_knit_sweater', '#efe4d0'),
    lambda: blouse('ivory_silk_blouse', '#f3ead9'),
    lambda: tee('breton_striped_top', '#f8f5ef', fit=.6, stripe='#27365a'),
    lambda: cami('blush_satin_cami', '#e9bfc2'),
    lambda: oxford('sage_linen_shirt', '#b9c7a9'),
    lambda: trousers('black_tailored_trousers', '#2b2a2f'),
    lambda: trousers('light_wash_jeans', '#9db6d1', jeans=True),
    lambda: trousers('beige_wide_leg_trousers', '#d9c3a5', wide=True),
    lambda: skirt('cream_pleated_skirt', '#ece0c8', pleated=True, midi=True),
    lambda: skirt('black_midi_skirt', '#2c2a30', midi=True),
    lambda: midi_dress('navy_silk_midi_dress', '#24345a'),
    lambda: midi_dress('rose_wrap_dress', '#cf8f97'),
    lambda: blazer('navy_blazer', '#27355a'),
    lambda: trench('beige_trench_coat', '#cdb18a'),
    lambda: denim_jacket('denim_jacket', '#7e9ec4'),
    lambda: cardigan('camel_cardigan', '#c9a27a'),
    lambda: sneakers('white_sneakers', '#ffffff'),
    lambda: loafers('black_loafers', '#2a2626'),
    lambda: heels('nude_heels', '#e2c2a4'),
    lambda: sandals('tan_sandals', '#b98756'),
    lambda: boots('brown_ankle_boots', '#6b4630'),
    lambda: bag('structured_black_bag', '#25232a'),
    lambda: bag('tan_leather_tote', '#b8875a', tote=True),
    lambda: scarf('silk_scarf'),
    lambda: earrings('gold_hoop_earrings'),
    lambda: sunglasses('tortoise_sunglasses'),
]
if __name__ == '__main__':
    for f in ITEMS: f()
    print(len(os.listdir(OUT)), 'svgs')
