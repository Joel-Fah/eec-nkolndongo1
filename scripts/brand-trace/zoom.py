import sys
from PIL import Image
L=sys.argv[1]; x0,y0,x1,y1=map(int,sys.argv[2:6]); s=int(sys.argv[6]); out=sys.argv[7]
a=Image.open(f'{L}/ref.png').convert('RGB').crop((x0,y0,x1,y1)); b=Image.open(f'{L}/mine.png').convert('RGB').crop((x0,y0,x1,y1))
w,h=a.size; c=Image.new('RGB',(w*s*2+10,h*s),(255,0,255))
c.paste(a.resize((w*s,h*s),Image.NEAREST),(0,0)); c.paste(b.resize((w*s,h*s),Image.NEAREST),(w*s+10,0)); c.save(out)
