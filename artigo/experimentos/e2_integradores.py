import json, time, numpy as np
from nbody import *
dias, ref = validacao('10')
out = {'wp': [], 'energia': {}}
# work-precision: Mercury error at +10 yr
for met, dts in [('leapfrog',[0.5,0.25,0.125,0.0625,1/32]),('yoshida4',[2,1,0.5,0.25,0.125]),('rk4',[2,1,0.5,0.25,0.125])]:
    for dt in dts:
        p,v,gm,_ = integrar(met, dt, dias)
        e = np.linalg.norm(p[1]-ref[1])*UA_KM
        aval = int(round(dias/dt))*AVALIACOES[met]
        out['wp'].append((met, dt, aval, e)); print(met, dt, aval, f'{e:.3e}')
# energy over 1000 years, dt=2 days all methods (record every 50 steps)
p0,v0,gm0 = estado_inicial(); E0 = energia(p0,v0,gm0); L0=np.linalg.norm(momento_angular(p0,v0,gm0))
for met in ['leapfrog','yoshida4','rk4']:
    reg = lambda k,p,v,gm: (k, (energia(p,v,gm)-E0)/abs(E0), (np.linalg.norm(momento_angular(p,v,gm))-L0)/L0)
    t=time.time()
    _,_,_,regs = integrar(met, 2.0, 365.25*1000, registrar=(100, reg))
    out['energia'][met] = regs; print(met, 'energia', regs[-1], time.time()-t)
json.dump(out, open('e2.json','w'))
