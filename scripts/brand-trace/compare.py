import sys, numpy as np
from PIL import Image
L=sys.argv[1]; mine=sys.argv[2]; ref=sys.argv[3]
a=np.asarray(Image.open(mine).convert('RGB')).astype(int); b=np.asarray(Image.open(ref).convert('RGB')).astype(int)
def cls(x):
    r,g,bb=x[...,0],x[...,1],x[...,2]
    c=np.zeros(r.shape,int)
    c[(r>200)&(g>200)&(bb<120)]=1; c[(g>r+40)&(g>bb+40)]=2; c[(r<90)&(g<90)&(bb<90)]=3
    return c
ca,cb=cls(a),cls(b)
for i,n in ((1,'yellow'),(2,'green'),(3,'black')):
    A=ca==i;B=cb==i; print(n,'IoU',round((A&B).sum()/(A|B).sum(),4))
diff=np.zeros(a.shape,np.uint8)+255
diff[(cb==3)&(ca!=3)]=[255,0,0]; diff[(ca==3)&(cb!=3)]=[0,0,255]
Image.fromarray(diff).save(sys.argv[4] if len(sys.argv)>4 else f'{L}/diff.png')
