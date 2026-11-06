import numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
plt.rcParams.update({'font.family':'serif','font.serif':['DejaVu Serif'],'mathtext.fontset':'cm','font.size':10})
import os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','figuras','')
def Rz(t): c,s=np.cos(t),np.sin(t); return np.array([[c,-s,0],[s,c,0],[0,0,1]])
def Rx(t): c,s=np.cos(t),np.sin(t); return np.array([[1,0,0],[0,c,-s],[0,s,c]])
O,I,W=np.radians([35,32,70]); a,e=1.0,0.35; nu0=np.radians(55)
R=Rz(O)@Rx(I)@Rz(W)
th=np.linspace(0,2*np.pi,400); r=a*(1-e*e)/(1+e*np.cos(th))
orb=(R@np.vstack([r*np.cos(th),r*np.sin(th),0*th])).T
fig=plt.figure(figsize=(6.2,4.6)); ax=fig.add_subplot(111,projection='3d'); ax.view_init(elev=28,azim=-20)
L=1.15
ax.add_collection3d(Poly3DCollection([[(-L,-L,0),(L,-L,0),(L,L,0),(-L,L,0)]],facecolor=(0.6,0.6,0.6,0.12),edgecolor=(0.5,0.5,0.5,0.4)))
ax.text(L*0.2,-L*1.05,0,'plano de referência (eclíptica)',fontsize=8,color='0.35')
up=orb[:,2]>=0
ax.plot(*np.where(up[:,None],orb,np.nan).T,color='#0072B2',lw=2)
ax.plot(*np.where(~up[:,None],orb,np.nan).T,color='#0072B2',lw=1.2,ls='--',alpha=.7)
ax.quiver(0,0,0,1.25,0,0,color='0.3',arrow_length_ratio=.08,lw=1); ax.text(1.28,-0.05,-0.05,r'$\gamma$',fontsize=11,color='0.3')
nd=np.array([np.cos(O),np.sin(O),0]); ax.plot(*np.array([-1.15*nd,1.15*nd]).T,color='0.25',ls=':',lw=1.2)
ax.text(*(-1.0*nd+[0,0,-.12]),'linha dos nodos',fontsize=8,color='0.25',ha='center')
rn=a*(1-e*e)/(1+e*np.cos(-W)); pn=R@np.array([rn*np.cos(-W),rn*np.sin(-W),0]); ax.scatter(*pn,color='k',s=12); ax.text(*(pn+[0.05,0,0.05]),'nodo\nascendente',fontsize=8)
pp=R@np.array([a*(1-e),0,0]); ax.plot([0,pp[0]],[0,pp[1]],[0,pp[2]],color='#009E73',lw=1); ax.scatter(*pp,color='#009E73',s=14); ax.text(*(pp+[0,0,.07]),'periélio',fontsize=8,color='#009E73')
rb=a*(1-e*e)/(1+e*np.cos(nu0)); pb=R@np.array([rb*np.cos(nu0),rb*np.sin(nu0),0]); ax.plot([0,pb[0]],[0,pb[1]],[0,pb[2]],color='#D55E00',lw=1); ax.scatter(*pb,color='#D55E00',s=22); ax.text(*(pb+[0,0,.08]),'corpo',fontsize=8,color='#D55E00')
ax.scatter(0,0,0,color='#E69F00',s=70,marker='*'); 
def arco(p0,eixo,ang,rad,cor,lab,off=1.25):
    t=np.linspace(0,ang,40); k=eixo/np.linalg.norm(eixo); u=p0/np.linalg.norm(p0); v=np.cross(k,u)
    pts=np.array([rad*(np.cos(x)*u+np.sin(x)*v) for x in t]); ax.plot(*pts.T,color=cor,lw=1.4)
    m=pts[len(pts)//2]*off; ax.text(*m,lab,color=cor,fontsize=12)
arco(np.array([1,0,0]),np.array([0,0,1]),O,0.42,'#CC79A7',r'$\Omega$')
h=R@np.array([0,0,1])
arco(nd,h,W,0.32,'#009E73',r'$\omega$',1.45)
arco(R@np.array([1,0,0]),h,nu0,0.62,'#D55E00',r'$\nu$',1.2)
# inclinacao: arco em torno da linha dos nodos, a partir do plano de referencia
tg=np.cross(h,nd); tg=tg/np.linalg.norm(tg)   # direcao do movimento no nodo ascendente (sobe)
hz=np.array([tg[0],tg[1],0]); hz/=np.linalg.norm(hz)
t=np.linspace(0,I,30); pts=np.array([pn+0.42*(np.cos(x)*hz+np.sin(x)*np.array([0,0,1])) for x in t])
ax.plot(*np.array([pn,pn+0.5*hz]).T,color='#56B4E9',lw=1,ls='-'); ax.plot(*np.array([pn,pn+0.5*tg]).T,color='#56B4E9',lw=1)
ax.plot(*pts.T,color='#56B4E9',lw=1.6); ax.text(*(pts[15]*1.0+0.06*hz+[0,0,0.03]),r'$i$',color='#2f7fb8',fontsize=12)
ax.set_xlim(-1.05,1.05); ax.set_ylim(-1.05,1.05); ax.set_zlim(-0.6,0.6); ax.set_box_aspect((1,1,0.6),zoom=1.0); ax.set_axis_off()
fig.subplots_adjust(0,0,1,1)
fig.savefig(OUT+'elementos.pdf',bbox_inches='tight',pad_inches=0.05)

# corta as margens brancas que o eixo 3D deixa (requer pypdfium2 e pypdf)
try:
    import pypdfium2 as pdfium
    from pypdf import PdfReader, PdfWriter
    arq = OUT + 'elementos.pdf'
    pg = pdfium.PdfDocument(arq)[0]; W, H = pg.get_size()
    img = np.array(pg.render(scale=1).to_pil().convert('L')); ys, xs = np.where(img < 245)
    r = PdfReader(arq); p = r.pages[0]; m = 4
    p.mediabox.lower_left = (xs.min() - m, H - ys.max() - m); p.mediabox.upper_right = (xs.max() + m, H - ys.min() + m)
    p.cropbox = p.mediabox
    w = PdfWriter(); w.add_page(p); w.write(arq)
except ImportError:
    pass
