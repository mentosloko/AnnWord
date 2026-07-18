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

def split(image):
    out=[]; step=image.height/4
    for i in range(4):
        top=max(0,round(i*step)-(22 if i else 0)); bottom=min(image.height,round((i+1)*step)+(22 if i<3 else 0))
        crop=image.crop((0,top,image.width,bottom)); out.append(crop.resize((780,round(crop.height*3))))
    return out

def tokens(text): return [x.upper() for x in re.findall(r'[A-Za-z]+',text)]

def distance(a,b):
    prev=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        cur=[i]
        for j,y in enumerate(b,1): cur.append(min(cur[-1]+1,prev[j]+1,prev[j-1]+(x!=y)))
        prev=cur
    return prev[-1]

def score(name,raw,seconds):
    recognized=[w for text in raw for w in tokens(text)]; exact=[w for w in EXPECTED if w in recognized]
    return {'name':name,'raw':raw,'recognized':recognized,'exact':exact,'exact_count':len(exact),'recall':round(len(exact)/24,4),'wer':round(distance(EXPECTED,recognized)/24,4),'seconds':round(seconds,3)}

def infer(images,model,processor):
    import torch
    out=[]
    for image in images:
        inputs=processor(image,return_tensors='pt')
        with torch.inference_mode():
            ids=model.generate(**inputs,do_sample=False,tokenizer=processor.tokenizer,stop_strings='<|im_end|>',max_new_tokens=256)
        out.append(processor.decode(ids[0,inputs['input_ids'].shape[1]:],skip_special_tokens=True))
    return out

def main():
    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor
    torch.set_num_threads(4); image=restore(); model_id='stepfun-ai/GOT-OCR-2.0-hf'
    processor=AutoProcessor.from_pretrained(model_id,use_fast=True); model=AutoModelForImageTextToText.from_pretrained(model_id).eval()
    results=[]
    for name,images in [('whole',[image]),('segments',split(image))]:
        start=time.perf_counter(); result=score(name,infer(images,model,processor),time.perf_counter()-start); results.append(result)
        (OUT/'result.json').write_text(json.dumps({'model':model_id,'expected':EXPECTED,'results':results},indent=2)); print(json.dumps(result,indent=2))

if __name__=='__main__': main()
