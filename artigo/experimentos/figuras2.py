import numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
exec(open('figuras.py').read().split('# --- trabalho')[0])
# Sol em torno do baricentro, 2026-2076, e Marte visto da Terra 2026-2028
p,v,gm=estado_inicial()
sol=[]; marte=[]
dt=0.5
for k in range(int(50*365.25/dt)):
    p,v=passo_yoshida(p,v,gm,dt)
    if k%20==0:
        cm=(gm[:,None]*p).sum(0)/gm.sum(); sol.append(p[0]-cm)
    if k*dt<=730:
        g=p[4]-p[3]; marte.append((k*dt+dt,np.degrees(np.arctan2(g[1],g[0]))%360, np.degrees(np.arcsin(g[2]/np.linalg.norm(g)))))
sol=np.array(sol)*UA_KM/695700; marte=np.array(marte)
fig,axs=plt.subplots(1,2,figsize=(W,2.9),gridspec_kw={'width_ratios':[1,1.35]})
ax=axs[0]; ax.plot(sol[:,0],sol[:,1],lw=.6,color=OI[0]); ax.add_patch(plt.Circle((0,0),1,fill=False,ls='--',color=OI[4]))
ax.plot(0,0,'+',color='k'); ax.set_aspect('equal'); ax.set_xlabel('$x$ [raios solares]'); ax.set_ylabel('$y$ [raios solares]')
ax.set_title('(a) centro do Sol, 2026–2076',fontsize=9)
ax=axs[1]; t=marte[:,0]; lon=np.unwrap(np.radians(marte[:,1]))
import datetime as D
datas=[D.date(2026,1,1)+D.timedelta(days=float(x)) for x in t]
ax.plot(datas,np.degrees(lon),color=OI[1],lw=1); ax.set_ylabel('longitude eclíptica geocêntrica [°]')
ret=np.diff(np.degrees(lon))<0; 
import matplotlib.dates as mdates
ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=[1,7])); ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%Y')); ax.tick_params(axis='x',labelsize=7.5)
i0=np.argmax(ret); i1=len(ret)-np.argmax(ret[::-1])-1
ax.axvspan(datas[i0],datas[i1],color=OI[1],alpha=.12); ax.text(datas[i0],np.degrees(lon).min()+5,f'retrógrado\n{datas[i0]:%d/%m/%Y}\na {datas[i1]:%d/%m/%Y}',fontsize=7)
ax.set_title('(b) Marte visto da Terra, 2026–2027',fontsize=9)
fig.tight_layout(); fig.savefig(OUT+'sol_marte.pdf'); plt.close(fig)
print('retro', datas[i0], datas[i1], 'sol max R', np.linalg.norm(sol,axis=1).max(), np.linalg.norm(sol,axis=1).min())

# figura no estilo da versao original (amostrada em angulo) vs tempo
el={'a':1.0,'e':0.5}
fig,axs=plt.subplots(1,2,figsize=(W,2.9))
for ax,f,tit in [(axs[0],orbita_angulo,'(a) amostragem em ângulo (versão original)'),(axs[1],orbita_tempo,'(b) amostragem no tempo (versões 2D e 3D)')]:
    z=f(el['a'],el['e'],1000); c=coef(z,3); tt=np.linspace(0,1,1000); zr=reconstruir(c,1,tt); zr3=reconstruir(c,3,tt)
    ax.plot(z.real,z.imag,color='0.6',lw=2.4,label='elipse de Kepler')
    ax.plot(zr.real,zr.imag,'--',color=OI[1],lw=1,label='$|n|\\leq1$'); ax.plot(zr3.real,zr3.imag,':',color=OI[0],lw=1.2,label='$|n|\\leq3$')
    ax.plot(0,0,'*',color=OI[4],ms=9); ax.plot(c[0].real,c[0].imag,'s',color='k',ms=3)
    ax.annotate(f'$c_0={c[0].real:+.3f}\\,a$',(c[0].real,c[0].imag),xytext=(5,8),textcoords='offset points',fontsize=7.5)
    ax.set_aspect('equal'); ax.set_title(tit,fontsize=8.5); ax.set_xlabel('$x/a$'); ax.set_ylabel('$y/a$'); ax.legend(fontsize=6.5,loc='lower left')
    print(tit, c[0], abs(c[1]), abs(c[-1]), abs(c[2]))
fig.tight_layout(); fig.savefig(OUT+'angulo_tempo.pdf'); plt.close(fig)
