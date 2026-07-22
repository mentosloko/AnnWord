import base64, json, re, time
from pathlib import Path
from PIL import Image, ImageEnhance, ImageOps

EXPECTED=['HI','KITE','FINE','RIDE','DRIVE','HOME','TREE','HOUSE','CHAIR','TABLE','RADIO','LOOK','NICE','BED','LEG','DESK','FLY','SKY','BYE','BONE','ROSE','GO','RUN','JUMP']
OUT=Path('florence-ocr-result')

def restore():
    parts=sorted(Path('testdata/easyocr').glob('sample-v2.b64.*'))
    data=re.sub(r'[^A-Za-z0-9+/=]','', ''.join(p.read_text() for p in parts))
    data+='='*((-len(data))%4)
    OUT.mkdir(parents=True,exist_ok=True)
    path=OUT/'dictionary.jpg'; path.write_bytes(base64.b64decode(data,validate=False))
    return Image.open(path).convert('RGB').crop((0,30,260,973))

def split(image):
    result=[]; step=image.height/4
    for i in range(4):
        top=max(0,round(i*step)-(22 if i else 0)); bottom=min(image.height,round((i+1)*step)+(22 if i<3 else 0))
        crop=image.crop((0,top,image.width,bottom)); result.append(crop.resize((780,round(crop.height*3))))
    return result

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
        inputs=processor(text='<OCR>',images=image,return_tensors='pt')
        with torch.inference_mode(): ids=model.generate(**inputs,max_new_tokens=512,num_beams=3)
        generated=processor.batch_decode(ids,skip_special_tokens=False)[0]
        parsed=processor.post_process_generation(generated,task='<OCR>',image_size=image.size)
        out.append(str(parsed.get('<OCR>',parsed)))
    return out

def main():
    import torch
    from transformers import AutoProcessor, Florence2ForConditionalGeneration
    torch.set_num_threads(4); image=restore(); contrast=ImageEnhance.Contrast(ImageOps.grayscale(image)).enhance(1.8).convert('RGB')
    model_id='florence-community/Florence-2-base-ft'; processor=AutoProcessor.from_pretrained(model_id); model=Florence2ForConditionalGeneration.from_pretrained(model_id).eval()
    results=[]
    for name,images in [('whole',[image]),('segments',split(image)),('contrast_segments',split(contrast))]:
        start=time.perf_counter(); result=score(name,infer(images,model,processor),time.perf_counter()-start); results.append(result)
        (OUT/'result.json').write_text(json.dumps({'model':model_id,'expected':EXPECTED,'results':results},indent=2)); print(json.dumps(result,indent=2))

if __name__=='__main__': main()
