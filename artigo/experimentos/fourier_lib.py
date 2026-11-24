"""Série de Fourier da órbita kepleriana: elementos osculadores, amostragem, DFT e a
forma fechada com funções de Bessel. Mesmo cálculo de simulador/src/nucleo/fourier.ts."""
import numpy as np
from scipy.special import jv, jvp

from nbody import estado_inicial

def elementos(i):
    p,v,gm = estado_inicial()
    r = p[i]-p[0]; w = v[i]-v[0]; mu = gm[0]+gm[i]
    rn, vn = np.linalg.norm(r), np.linalg.norm(w)
    a = -mu/(vn**2-2*mu/rn)
    h = np.cross(r,w); evec = np.cross(w,h)/mu - r/rn
    e = np.linalg.norm(evec); inc = np.degrees(np.arccos(h[2]/np.linalg.norm(h)))
    T = 2*np.pi*np.sqrt(a**3/mu)
    return dict(a=a,e=e,i=inc,T=T,mu=mu)

def kepler_E(M,e,tol=1e-14):
    E = M + 0.85*e*np.sign(np.sin(M)+ (np.sin(M)==0))
    for _ in range(50):
        d = (E-e*np.sin(E)-M)/(1-e*np.cos(E)); E=E-d
        if np.all(np.abs(d)<tol): break
    return E

def orbita_tempo(a,e,A=720):
    M = 2*np.pi*np.arange(A)/A
    E = kepler_E(M,e)
    return a*(np.cos(E)-e) + 1j*a*np.sqrt(1-e*e)*np.sin(E)

def orbita_angulo(a,e,A=720):
    th = 2*np.pi*np.arange(A)/A
    r = a*(1-e*e)/(1+e*np.cos(th))
    return r*np.exp(1j*th)

def coef(z, N):
    A = len(z); k = np.arange(A)
    return {n: (z*np.exp(-2j*np.pi*n*k/A)).mean() for n in range(-N,N+1)}

def coef_bessel(a,e,n):
    b = a*np.sqrt(1-e*e)
    if n==0: return -1.5*a*e
    m = abs(n)
    base = (a/m)*jvp(m,m*e); extra = (b/(m*e))*jv(m,m*e)
    return base+extra if n>0 else base-extra

def reconstruir(c, N, t):
    return sum(c[n]*np.exp(2j*np.pi*n*t) for n in range(-N,N+1))

def desvio(z, c, N):
    A=len(z); t=np.arange(A)/A
    d = np.abs(z-reconstruir(c,N,t)); return d.mean(), d.max()
