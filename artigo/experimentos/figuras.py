import json, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from fourier_lib import *
import os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','figuras','')
plt.rcParams.update({'font.family':'serif','font.serif':['DejaVu Serif'],'mathtext.fontset':'cm','font.size':10,
  'axes.spines.top':False,'axes.spines.right':False,'axes.grid':True,'grid.alpha':.25,'savefig.bbox':'tight','legend.frameon':False})
OI=['#0072B2','#D55E00','#009E73','#CC79A7','#E69F00','#56B4E9','#F0E442','#000000']
W=6.0
cor={'leapfrog':OI[1],'yoshida4':OI[0],'rk4':OI[2]}
rot={'leapfrog':'Leapfrog (2ª ordem)','yoshida4':'Yoshida (4ª ordem)','rk4':'Runge–Kutta 4 (não simplético)'}

# --- trabalho x precisao
d=json.load(open('e2.json'))
fig,ax=plt.subplots(figsize=(W,3.4))
for met in ['leapfrog','rk4','yoshida4']:
    pts=[(a,e,dt) for m,dt,a,e in d['wp'] if m==met]
    ax.loglog([p[0] for p in pts],[p[1] for p in pts],'o-',color=cor[met],label=rot[met])
    for a,e,dt in pts:
        if met=='yoshida4' and dt==0.5: ax.annotate('passo do programa\n(0,5 dia)',(a,e),xytext=(a*1.6,e*12),arrowprops=dict(arrowstyle='->',lw=.7),fontsize=8)
ax.axhspan(1000,2500,color='gray',alpha=.15); ax.text(6000,1250,'piso do modelo (efeitos ausentes, ex.: relatividade)',fontsize=7.5,color='0.3')
ax.set_xlabel('avaliações da força em 10 anos simulados (custo)'); ax.set_ylabel('erro de Mercúrio após 10 anos [km]')
ax.legend(fontsize=8); fig.savefig(OUT+'trabalho_precisao.pdf'); plt.close(fig)

# --- energia
fig,axs=plt.subplots(1,2,figsize=(W,2.8))
for met in ['rk4','leapfrog','yoshida4']:
    r=np.array(d['energia'][met]); anos=r[:,0]*2/365.25
    axs[0].plot(anos,np.abs(r[:,1]),color=cor[met],lw=.8,label=rot[met])
axs[0].set_yscale('log'); axs[0].set_xlabel('tempo simulado [anos]'); axs[0].set_ylabel(r'$|\Delta E/E_0|$'); axs[0].set_title('(a) os três métodos',fontsize=9)
r=np.array(d['energia']['yoshida4']); anos=r[:,0]*2/365.25
axs[1].plot(anos,r[:,1],color=cor['yoshida4'],lw=.5); axs[1].set_xlabel('tempo simulado [anos]'); axs[1].set_ylabel(r'$\Delta E/E_0$'); axs[1].set_title('(b) Yoshida: oscila, não cresce',fontsize=9)
axs[1].ticklabel_format(axis='y',style='sci',scilimits=(0,0))
fig.legend(*axs[0].get_legend_handles_labels(),loc='lower center',ncol=3,fontsize=7.5,bbox_to_anchor=(.5,-.08))
fig.tight_layout(rect=(0,.06,1,1)); fig.savefig(OUT+'energia.pdf'); plt.close(fig)

# --- segunda lei: amostragem no tempo
fig,axs=plt.subplots(1,2,figsize=(W,2.6))
e=0.5; z=orbita_tempo(1,e,36); zz=orbita_tempo(1,e,720)
for ax,zs,tit in [(axs[0],z,'(a) igual espaçamento no tempo'),(axs[1],orbita_angulo(1,e,36),'(b) igual espaçamento no ângulo')]:
    ax.plot(zz.real,zz.imag,color='0.6',lw=.8); ax.plot(zs.real,zs.imag,'o',ms=3,color=OI[0]); ax.plot(0,0,'*',color=OI[4],ms=10)
    ax.set_aspect('equal'); ax.set_title(tit,fontsize=8); ax.set_xticks([]); ax.set_yticks([]); ax.grid(False)
    for s in ax.spines.values(): s.set_visible(False)
fig.savefig(OUT+'amostragem.pdf'); plt.close(fig)

# --- convergencia de Fourier
fig,axs=plt.subplots(1,2,figsize=(W,2.9))
for i in range(1,9):
    el=elementos(i); z=orbita_tempo(el['a'],el['e']); c=coef(z,24)
    dv=[desvio(z,c,N)[0] for N in range(1,25)]
    axs[0].semilogy(range(1,25),np.maximum(dv,1e-17),'-',lw=1,color=plt.cm.viridis(i/9),label=NOMES[i])
axs[0].axhline(1e-12,color='k',ls=':',lw=.8); axs[0].set_xlabel('harmônicos $N$'); axs[0].set_ylabel('desvio médio [UA]'); axs[0].set_title('(a) os oito planetas',fontsize=9)
axs[0].legend(fontsize=6.5,ncol=2)
for e,cc in zip([0.2,0.6,0.9,0.95],OI):
    z=orbita_tempo(1,e); c=coef(z,24); dv=[desvio(z,c,N)[0] for N in range(1,25)]
    axs[1].semilogy(range(1,25),np.maximum(dv,1e-17),color=cc,label=f'$e={e}$')
axs[1].set_xlabel('harmônicos $N$'); axs[1].set_ylabel('desvio médio [UA], $a=1$'); axs[1].set_title('(b) efeito da excentricidade',fontsize=9); axs[1].legend(fontsize=7)
fig.tight_layout(); fig.savefig(OUT+'convergencia.pdf'); plt.close(fig)

# --- cadeia de epiciclos
def cadeia(ax,a,e,N,t,tit):
    z=orbita_tempo(a,e,720); c=coef(z,N)
    ax.plot(z.real,z.imag,color='0.75',lw=2.2,label='elipse de Kepler')
    tt=np.linspace(0,1,600); zr=reconstruir(c,N,tt); ax.plot(zr.real,zr.imag,'--',color=OI[1],lw=1,label=f'série com $|n|\\leq{N}$')
    ns=sorted([n for n in c if n!=0],key=lambda n:-abs(c[n]))
    p=c[0]; ax.plot([0,p.real],[0,p.imag],color=OI[4],lw=1.2); ax.plot(p.real,p.imag,'s',color=OI[4],ms=3)
    for n in ns:
        r=abs(c[n]); q=p+c[n]*np.exp(2j*np.pi*n*t)
        ax.add_patch(plt.Circle((p.real,p.imag),r,fill=False,color=OI[0],lw=.6,alpha=.8)); ax.plot([p.real,q.real],[p.imag,q.imag],color=OI[0],lw=1)
        p=q
    ax.plot(p.real,p.imag,'o',color=OI[3],ms=4); ax.plot(0,0,'*',color=OI[4],ms=10)
    ax.set_aspect('equal'); ax.set_title(tit,fontsize=8.5); ax.set_xticks([]); ax.set_yticks([]); ax.grid(False)
    for s in ax.spines.values(): s.set_visible(False)
fig,axs=plt.subplots(1,3,figsize=(W,2.4))
for ax,N in zip(axs,[1,2,4]): cadeia(ax,1,0.5,N,0.18,f'$e=0{{,}}5$, $|n|\\leq {N}$')
axs[0].legend(fontsize=6.5,loc='lower left',bbox_to_anchor=(0,-.32)); fig.savefig(OUT+'epiciclos.pdf'); plt.close(fig)

# --- Copernico
cp=json.load(open('e4.json'))
fig,axs=plt.subplots(1,2,figsize=(W,2.9))
x=np.arange(len(cp)); nm=[r['planeta'] for r in cp]
wb=.2
axs[0].bar(x-1.5*wb,[r['r1'] for r in cp],wb,color=OI[1],label='Copérnico $r_1$')
axs[0].bar(x-.5*wb,[r['c0'] for r in cp],wb,color=OI[0],label='Fourier $|c_0|$')
axs[0].bar(x+.5*wb,[r['r2'] for r in cp],wb,color=OI[1],alpha=.45,label='Copérnico $r_2$')
axs[0].bar(x+1.5*wb,[r['c2'] for r in cp],wb,color=OI[0],alpha=.45,label='Fourier $|c_2|$')
axs[0].set_yscale('log'); axs[0].set_xticks(x,nm,fontsize=7,rotation=25); axs[0].set_ylabel('raio [UA]'); axs[0].legend(fontsize=6.3,loc='upper left',ncol=2); axs[0].set_ylim(1e-3,5); axs[0].set_title('(a) raios dos epiciclos',fontsize=9)
axs[1].plot(x,[r['e'] for r in cp],'o-',color='k',label='$e$ moderno (este trabalho)')
axs[1].plot(x,[r['e_r1'] for r in cp],'s--',color=OI[1],label='$e$ implícito em $r_1 = \\frac{3}{2}Re$')
axs[1].plot(x,[r['e_r2'] for r in cp],'^:',color=OI[2],label='$e$ implícito em $r_2 = \\frac{1}{2}Re$')
axs[1].set_xticks(x,nm,fontsize=7,rotation=25); axs[1].set_ylabel('excentricidade'); axs[1].legend(fontsize=6.5); axs[1].set_title('(b) excentricidade implícita',fontsize=9)
fig.tight_layout(); fig.savefig(OUT+'copernico.pdf'); plt.close(fig)

# --- Kepler: iteracoes
def iters(M,e,chute):
    E = M if chute=='M' else M+0.85*e*np.sign(np.sin(M) if np.sin(M)!=0 else 1)
    for k in range(1,60):
        df=1-e*np.cos(E)
        if abs(df)<1e-14: return 60
        d=(E-e*np.sin(E)-M)/df; E-=d
        if abs(d)<1e-13: return k
        if not np.isfinite(E): return 60
    return 60
es=np.concatenate([np.linspace(0,0.95,60),np.linspace(0.951,0.999,40)]); Ms=np.concatenate([np.logspace(-8,-1,120),np.linspace(0.1,2*np.pi-1e-3,500)])
fig,ax=plt.subplots(figsize=(W,2.7))
for ch,cc,lab in [('M',OI[1],'chute $E_0=M$'),('D',OI[0],'chute de Danby $E_0=M+0{,}85\\,e\\,\\mathrm{sgn}(\\sin M)$')]:
    mx=[max(iters(M,e,ch) for M in Ms) for e in es]
    ax.plot(es,mx,color=cc,label=lab)
ax.set_xlabel('excentricidade $e$'); ax.set_ylabel('iterações de Newton (pior $M$)'); ax.set_ylim(0,62); ax.legend(fontsize=8)
ax.text(0.02,55,'60 = não convergiu em 60 iterações',fontsize=7.5,color='0.3')
fig.savefig(OUT+'kepler_iteracoes.pdf'); plt.close(fig)

# --- compressao
r=np.linspace(0,32,400)
fig,ax=plt.subplots(figsize=(W*.62,2.6))
ax.plot(r,r,'--',color='0.5',label='escala real'); ax.plot(r,np.sqrt(r),color=OI[0],label=r'$r_\mathrm{des}=\sqrt{r\cdot 1\,\mathrm{UA}}$')
for i in range(1,9):
    el=elementos(i); ax.plot(el['a'],np.sqrt(el['a']),'o',ms=3,color=OI[1]); 
    if i in (1,4,5,8): ax.annotate(NOMES[i],(el['a'],np.sqrt(el['a'])),xytext=(3,-9),textcoords='offset points',fontsize=7)
ax.set_xlabel('distância real ao Sol [UA]'); ax.set_ylabel('distância desenhada [UA]'); ax.set_ylim(0,8); ax.legend(fontsize=7.5)
fig.savefig(OUT+'compressao.pdf'); plt.close(fig)
print('ok')
