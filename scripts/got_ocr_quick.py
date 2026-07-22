import base64, json, re, time
from pathlib import Path
from PIL import Image

EXPECTED=['HI','KITE','FINE','RIDE','DRIVE','HOME','TREE','HOUSE','CHAIR','TABLE','RADIO','LOOK','NICE','BED','LEG','DESK','FLY','SKY','BYE','BONE','ROSE','GO','RUN','JUMP']
OUT=Path('got-ocr-result')

def restore():
    parts=sorted(Path('testdata/easyocr').glob('sample-v2.b64.*'))
    data=re.sub(r'[^A-Za-z0-9+/=]','', ''.join(p.read_text() for p in parts)); data+='='*((-len(data))%4)
    OUT.mkdir(parents=True,exist_ok=True); path=OUT/'dictionary.jpg'; path.write_bytes(base64.b64decode(data,validate=False))
    return Image.open(path).convert('RGB').crop((0,30,260,973))

def tokens(text): return [x.upper() for x in re.findall(r'[A-Za-z]+',text)]

def distance(a,b):
    prev=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        cur=[i]
        for j,y in enumerate(b,1): cur.append(min(cur[-1]+1,prev[j]+1,prev[j-1]+(x!=y)))
        prev=cur
    return prev[-1]

def score(raw,seconds):
    recognized=tokens(raw); exact=[w for w in EXPECTED if w in recognized]
    return {'name':'whole','raw':[raw],'recognized':recognized,'exact':exact,'exact_count':len(exact),'recall':round(len(exact)/24,4),'wer':round(distance(EXPECTED,recognized)/24,4),'seconds':round(seconds,3)}

def main():
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    torch.set_num_threads(4); image=restore(); model_id='stepfun-ai/GOT-OCR-2.0-hf'
    processor=AutoProcessor.from_pretrained(model_id,use_fast=True); model=AutoModelForImageTextToText.from_pretrained(model_id).eval()
    inputs=processor(image,return_tensors='pt'); start=time.perf_counter()
    with torch.inference_mode():
        ids=model.generate(**inputs,do_sample=False,tokenizer=processor.tokenizer,stop_strings='<|im_end|>',max_new_tokens=96)
    raw=processor.decode(ids[0,inputs['input_ids'].shape[1]:],skip_special_tokens=True)
    result=score(raw,time.perf_counter()-start)
    (OUT/'result.json').write_text(json.dumps({'model':model_id,'expected':EXPECTED,'results':[result]},indent=2)); print(json.dumps(result,indent=2))

if __name__=='__main__': main()
