import pdfplumber, json, re, sys, os, subprocess, logging
logging.disable(logging.WARNING)
RED=(0.6314,0.1529,0.1216)
def isred(c):
    col=c.get('non_stroking_color')
    if not col or len(col)!=3: return False
    return all(abs(a-b)<0.02 for a,b in zip(col,RED))
HDR=re.compile(r'^(Software (Requirements Specification|Design Document).*(Page \d+|Fall 2026)|\s*Page \d+ of \d+|Team Closet\s*$)')
def extract(pdf, first, last, outdir, tag):
    os.makedirs(outdir,exist_ok=True)
    p=pdfplumber.open(pdf); blocks=[]
    for pn in range(first,last+1):
        pg=p.pages[pn-1].filter(lambda o: not(o.get('object_type')=='char' and isred(o)))
        H=pg.height; W=pg.width
        tabs=pg.find_tables()
        items=[]; good=[]
        for t in tabs:
            rows=[[ (c or '').replace('\n',' ').strip() for c in r] for r in t.extract()]
            if len(rows)>=2 and max(len(r) for r in rows)>=2: items.append((t.bbox[1],'table',rows,t.bbox)); good.append(t)
        imgs=[m for m in p.pages[pn-1].images if (m['x1']-m['x0'])>80 and (m['bottom']-m['top'])>50]
        for k,m in enumerate(imgs):
            png=f"{outdir}/{tag}_p{pn}_{k}.png"
            if not os.path.exists(png):
                subprocess.run(['pdftoppm','-f',str(pn),'-l',str(pn),'-r','170','-png','-singlefile','-x',str(int(m['x0']*170/72)),'-y',str(int(m['top']*170/72)),'-W',str(int((m['x1']-m['x0'])*170/72)),'-H',str(int((m['bottom']-m['top'])*170/72)),pdf,png[:-4]])
            items.append((m['top'],'img',png,None))
        def intab(l):
            for t in good:
                x0,y0,x1,y1=t.bbox
                if l['top']>=y0-1 and l['bottom']<=y1+1 and l['x0']>=x0-2: return True
            return False
        for l in pg.extract_text_lines(return_chars=True):
            if intab(l): continue
            txt=l['text'].strip()
            if not txt or HDR.match(txt): continue
            ch=[c for c in l['chars'] if c['text'].strip()]
            if not ch: continue
            fn=ch[0]['fontname']; sz=round(max(c['size'] for c in ch),1)
            bold='Bold' in fn or 'SemiBold' in fn
            runs=[];k=0;full=l['text']
            for chx in full:
                if chx==' ':
                    if runs: runs[-1][1]+=' '
                    continue
                c=ch[k] if k<len(ch) else ch[-1]; k+=1
                bb=('Bold' in c['fontname']); it=('Italic' in c['fontname'] or 'Oblique' in c['fontname']); mono='Mono' in c['fontname']
                key=(bb,it,mono)
                if runs and runs[-1][0]==key: runs[-1][1]+=chx
                else: runs.append([key,chx])
            items.append((l['top'],'line',{'runs':[[list(a),b] for a,b in runs],'t':txt,'sz':sz,'b':bold,'f':fn.split('+')[-1],'x':round(l['x0']),'top':round(l['top']),'bot':round(l['bottom'])},None))
        items.sort(key=lambda i:i[0])
        for it in items:
            blocks.append({'page':pn,'kind':it[1],'data':it[2]})
    return blocks
if __name__=='__main__':
    pdf,first,last,out,tag=sys.argv[1:6]
    b=extract(pdf,int(first),int(last),out+'/img',tag)
    json.dump(b,open(f'{out}/{tag}.json','w'),indent=0)
    print(tag,len(b))
