import json, time, numpy as np
from nbody import *
res = {}
t0=time.time()
for ch in ['1','10','-10','100','-100']:
    dias, ref = validacao(ch)
    p,v,gm,_ = integrar('yoshida4', 0.5, dias)
    err = np.linalg.norm(p-ref,axis=1)*UA_KM
    rsol = np.linalg.norm(ref-ref[0],axis=1)*UA_KM
    res[ch] = {'erro_km': err.tolist(), 'frac': (err/np.where(rsol>0,rsol,np.nan)).tolist()}
    print(ch, ' '.join(f'{e:,.1f}' for e in err), f'{time.time()-t0:.0f}s')
json.dump(res, open('e1.json','w'))
