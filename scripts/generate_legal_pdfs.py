#!/usr/bin/env python3
import base64,gzip,html,os,re
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle,getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate,Frame,PageTemplate,Paragraph,Spacer,PageBreak

HERE=Path(__file__).resolve(); ROOT=HERE.parents[1] if HERE.parent.name=='scripts' else HERE.parent
SRC=Path(os.getenv('LEGAL_SOURCE_DIR',ROOT/'legal-src')); OUT=Path(os.getenv('LEGAL_OUTPUT_DIR',ROOT/'public/legal'))
FILES={'01_user_agreement.md':'annword-user-agreement.pdf','02_public_offer.md':'annword-public-offer.pdf','03_privacy_policy.md':'annword-privacy-policy.pdf','04_cookie_policy.md':'annword-cookie-policy.pdf','05_personal_data_consent.md':'annword-personal-data-consent.pdf','06_child_data_consent.md':'annword-child-data-consent.pdf','07_marketing_consent.md':'annword-marketing-consent.pdf'}
REG='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def mark(s):
 s=html.escape(s.strip()); s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s); s=re.sub(r'`(.+?)`',r'\1',s); return s

def getdocs():
 enc=''.join(p.read_text().strip() for p in sorted(SRC.glob('legal-documents.b64.part*')))
 raw=gzip.decompress(base64.b64decode(enc)).decode(); out={}
 for b in raw.split('@@FILE:')[1:]:
  n,t=b.split('@@\n',1); out[n.strip()]=t.strip()
 return out

def sty():
 b=getSampleStyleSheet()
 return {'t':ParagraphStyle('t',parent=b['Title'],fontName='AWB',fontSize=18,leading=23,alignment=TA_CENTER,textColor=colors.HexColor('#1e1b4b'),spaceAfter=8*mm,keepWithNext=True),'h2':ParagraphStyle('h2',parent=b['Heading2'],fontName='AWB',fontSize=12.5,leading=16,textColor=colors.HexColor('#312e81'),spaceBefore=5*mm,spaceAfter=2.5*mm,keepWithNext=True),'h3':ParagraphStyle('h3',parent=b['Heading3'],fontName='AWB',fontSize=11,leading=14,textColor=colors.HexColor('#3730a3'),spaceBefore=3.5*mm,spaceAfter=2*mm,keepWithNext=True),'p':ParagraphStyle('p',parent=b['BodyText'],fontName='AW',fontSize=9.4,leading=13.2,textColor=colors.HexColor('#1f2937'),spaceAfter=2.1*mm),'m':ParagraphStyle('m',parent=b['BodyText'],fontName='AW',fontSize=8.8,leading=12.2,textColor=colors.HexColor('#475569'),spaceAfter=1.4*mm),'li':ParagraphStyle('li',parent=b['BodyText'],fontName='AW',fontSize=9.2,leading=13,leftIndent=5*mm,firstLineIndent=-3.5*mm,bulletIndent=1*mm,textColor=colors.HexColor('#1f2937'),spaceAfter=1.5*mm),'box':ParagraphStyle('box',parent=b['BodyText'],fontName='AW',fontSize=8.5,leading=11.7,leftIndent=3.5*mm,rightIndent=2*mm,borderColor=colors.HexColor('#e0e7ff'),borderWidth=.6,borderPadding=5,backColor=colors.HexColor('#f8fafc'),textColor=colors.HexColor('#334155'),spaceAfter=1.7*mm)}

def table(lines,s):
 rows=[]
 for x in lines:
  c=[v.strip() for v in x.strip('|').split('|')]
  if c and all(re.fullmatch(r':?-{3,}:?',v.replace(' ','')) for v in c): continue
  rows.append(c)
 if not rows:return []
 head=rows[0]; res=[]
 for row in (rows[1:] if len(rows)>1 else rows):
  z=[]
  for i,v in enumerate(row):
   if v:z.append((f'<b>{mark(head[i])}:</b> ' if len(rows)>1 and i<len(head) and head[i] else '')+mark(v))
  if z:res.append(Paragraph(' &nbsp; '.join(z),s['box']))
 res.append(Spacer(1,1.5*mm));return res

def story(md,s):
 a=md.splitlines();r=[];i=0;title=False
 while i<len(a):
  x=a[i].strip()
  if not x:i+=1;continue
  if x.startswith('|') and x.endswith('|'):
   q=[]
   while i<len(a) and a[i].strip().startswith('|') and a[i].strip().endswith('|'):q.append(a[i].strip());i+=1
   r+=table(q,s);continue
  if x.startswith('# '):
   if title:r.append(PageBreak())
   r.append(Paragraph(mark(x[2:]),s['t']));title=True
  elif x.startswith('## '):r.append(Paragraph(mark(x[3:]),s['h2']))
  elif x.startswith('### '):r.append(Paragraph(mark(x[4:]),s['h3']))
  elif re.match(r'^[-*]\s+',x):r.append(Paragraph(mark(re.sub(r'^[-*]\s+','',x)),s['li'],bulletText='•'))
  elif x.startswith('> '):r.append(Paragraph(mark(x[2:]),s['box']))
  else:r.append(Paragraph(mark(x),s['m'] if x.startswith('**') and x.endswith('**') else s['p']))
  i+=1
 return r

class Doc(BaseDocTemplate):
 def __init__(self,f,title):
  super().__init__(f,pagesize=A4,leftMargin=19*mm,rightMargin=19*mm,topMargin=18*mm,bottomMargin=18*mm,title=title,author='ИП Манто Ирина Александровна')
  self.addPageTemplates(PageTemplate(id='p',frames=Frame(self.leftMargin,self.bottomMargin,self.width,self.height,id='f'),onPage=self.foot))
 def foot(self,c,d):
  c.saveState();c.setStrokeColor(colors.HexColor('#e0e7ff'));c.line(19*mm,13*mm,A4[0]-19*mm,13*mm);c.setFont('AW',7.5);c.setFillColor(colors.HexColor('#64748b'));c.drawString(19*mm,8.8*mm,'AnnWord · support@annword.ru');c.drawRightString(A4[0]-19*mm,8.8*mm,f'Страница {d.page}');c.restoreState()

def main():
 pdfmetrics.registerFont(TTFont('AW',REG));pdfmetrics.registerFont(TTFont('AWB',BOLD));docs=getdocs();OUT.mkdir(parents=True,exist_ok=True);s=sty()
 for src,dst in FILES.items():
  md=docs[src]; title=(re.search(r'^#\s+(.+)$',md,re.M) or [None,dst])[1]; p=OUT/dst;Doc(str(p),title).build(story(md,s));print(f'Generated {p} ({p.stat().st_size} bytes)')
if __name__=='__main__':main()
