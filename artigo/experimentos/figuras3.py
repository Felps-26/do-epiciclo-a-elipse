import numpy as np, matplotlib, datetime as D
matplotlib.use('Agg'); import matplotlib.pyplot as plt, matplotlib.dates as mdates
exec(open('figuras.py').read().split('# --- trabalho')[0])
p,v,gm=estado_inicial(); sol=[]; marte=[]; dt=0.5
for k in range(int(50*365.25/dt)):
    p,v=passo_yoshida(p,v,gm,dt)
    if k%20==0:
        cm=(gm[:,None]*p).sum(0)/gm.sum(); sol.append(p[0]-cm)
    if k*dt<=760:
        g=p[4]-p[3]; marte.append((k*dt+dt,np.degrees(np.arctan2(g[1],g[0])), np.degrees(np.arcsin(g[2]/np.linalg.norm(g)))))
sol=np.array(sol)*UA_KM/695700; marte=np.array(marte)
fig,ax=plt.subplots(figsize=(W*.55,W*.55))
ax.plot(sol[:,0],sol[:,1],lw=.6,color=OI[0]); ax.add_patch(plt.Circle((0,0),1,fill=False,ls='--',color=OI[4],label='tamanho do disco solar'))
ax.plot(0,0,'+',color='k',ms=9,label='centro de massa'); ax.plot(sol[0,0],sol[0,1],'o',color=OI[1],ms=4,label='jan/2026'); ax.set_aspect('equal'); ax.set_xlabel('$x$ [raios solares]'); ax.set_ylabel('$y$ [raios solares]')
ax.legend(fontsize=7,loc='lower left'); fig.savefig(OUT+'sol_baricentro.pdf'); plt.close(fig)
t=marte[:,0]; lon=np.degrees(np.unwrap(np.radians(marte[:,1]))); lon=lon-360*np.floor(lon[0]/360); lat=marte[:,2]
datas=[D.date(2026,1,1)+D.timedelta(days=float(x)) for x in t]
fig,axs=plt.subplots(1,2,figsize=(W,2.8),gridspec_kw={'width_ratios':[1.3,1]})
ax=axs[0]; ax.plot(datas,lon%360 if False else lon,color=OI[1],lw=1)
ret=np.diff(lon)<0; i0=np.argmax(ret); i1=len(ret)-np.argmax(ret[::-1])-1
ax.axvspan(datas[i0],datas[i1],color=OI[1],alpha=.12); ax.text(datas[i1],lon.min()+20,f'  retrógrado:\n  {datas[i0]:%d/%m/%Y}\n  a {datas[i1]:%d/%m/%Y}',fontsize=7)
ax.xaxis.set_major_locator(mdates.MonthLocator(bymonth=[1,7])); ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%Y')); ax.tick_params(axis='x',labelsize=7)
ax.set_ylabel('longitude eclíptica [°]'); ax.set_title('(a) longitude de Marte vista da Terra',fontsize=9)
ax=axs[1]; sel=slice(max(i0-120,0),min(i1+120,len(lon)))
ax.plot(lon[sel]%360,lat[sel],color=OI[1],lw=1); ax.plot(lon[i0]%360,lat[i0],'o',ms=3,color='k'); ax.plot(lon[i1]%360,lat[i1],'s',ms=3,color='k')
ax.invert_xaxis(); ax.set_xlabel('longitude eclíptica [°]'); ax.set_ylabel('latitude eclíptica [°]'); ax.set_title('(b) o laço no céu',fontsize=9)
fig.tight_layout(); fig.savefig(OUT+'marte_retrogrado.pdf'); plt.close(fig)
print(datas[i0],datas[i1])
