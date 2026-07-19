from __future__ import annotations

import base64, json, os, re, time, urllib.error, urllib.request
from pathlib import Path
from typing import Any

API_URL='https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText'
EXPECTED=['HI','KITE','FINE','RIDE','DRIVE','HOME','TREE','HOUSE','CHAIR','TABLE','RADIO','LOOK','NICE','BED','LEG','DESK','FLY','SKY','BYE','BONE','ROSE','GO','RUN','JUMP']
OUT=Path('yandex-vision-benchmark')

def restore_image():
    parts=sorted(Path('testdata/easyocr').glob('sample-v2.b64.*'))
    if not parts: raise RuntimeError('sample-v2 image chunks not found')
    encoded=re.sub(r'[^A-Za-z0-9+/=]','', ''.join(p.read_text() for p in parts)); encoded+='='*((-len(encoded))%4)
    OUT.mkdir(parents=True,exist_ok=True); path=OUT/'cropped-word-column.jpg'; path.write_bytes(base64.b64decode(encoded,validate=False)); return path

def call(path,token,folder,model):
    payload={'mimeType':'JPEG','languageCodes':['en'],'model':model,'content':base64.b64encode(path.read_bytes()).decode()}
    req=urllib.request.Request(API_URL,data=json.dumps(payload).encode(),method='POST',headers={'Authorization':f'Bearer {token}','Content-Type':'application/json','x-folder-id':folder,'x-data-logging-enabled':'false'})
    started=time.perf_counter()
    try:
        with urllib.request.urlopen(req,timeout=120) as r: return json.loads(r.read().decode()),time.perf_counter()-started
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code}: {e.read().decode(errors="replace")}')

def lines_from(x:Any):
    out=[]
    def walk(n):
        if isinstance(n,dict):
            if isinstance(n.get('lines'),list):
                for z in n['lines']:
                    if isinstance(z,dict) and isinstance(z.get('text'),str) and z['text'].strip(): out.append(z['text'].strip())
            for k,v in n.items():
                if k!='lines': walk(v)
        elif isinstance(n,list):
            for v in n: walk(v)
    walk(x); return out

def lev(a,b):
    p=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        c=[i]
        for j,y in enumerate(b,1): c.append(min(c[-1]+1,p[j]+1,p[j-1]+(x!=y)))
        p=c
    return p[-1]

def evaluate(lines):
    words=[]
    for s in lines: words += [w.upper() for w in re.findall(r'[A-Za-z]+',s)]
    rem=list(words); exact=[]
    for w in EXPECTED:
        if w in rem: exact.append(w); rem.remove(w)
    return {'lines':lines,'recognized_words':words,'recognized_count':len(words),'exact_matches':exact,'exact_count':len(exact),'exact_recall':round(len(exact)/24,4),'wer':round(lev(EXPECTED,words)/24,4),'missing':[w for w in EXPECTED if w not in words],'extras':[w for w in words if w not in EXPECTED]}

def main():
    token=os.environ.get('YC_IAM_TOKEN','').strip(); folder=os.environ.get('YC_FOLDER_ID','').strip()
    if not token or not folder: raise SystemExit('YC_IAM_TOKEN and YC_FOLDER_ID required')
    path=restore_image(); report={'expected':EXPECTED,'results':[],'errors':[]}
    for model in ['handwritten','page']:
        try:
            raw,seconds=call(path,token,folder,model); (OUT/f'{model}-response.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2))
            r=evaluate(lines_from(raw)); r.update({'model':model,'seconds':round(seconds,3)}); report['results'].append(r); print(json.dumps(r,ensure_ascii=False,indent=2))
        except Exception as e:
            err={'model':model,'error':str(e)}; report['errors'].append(err); print(json.dumps(err,ensure_ascii=False))
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
