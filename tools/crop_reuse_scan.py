#!/usr/bin/env python3
"""crop_reuse_scan.py v01.3 (Grok, 2026-11-15). Crop/regrade-invariant reuse detector.
Closes the gap in scripts/video_craft_qc.py --compare (full-frame dHash only): a candidate frame is
downscaled to crop scale s (0.50..1.00), template-matched over every reference frame on grade-normalised
(histogram-equalised) grayscale; the Sobel-gradient NCC at the best location is the grade-insensitive score.
Frame is REUSE if gradient NCC >= --thr (default 0.30). Report seconds of reuse per reference + spans.

v01.1 changes vs v01 (2fdf18e2), detection math unchanged:
  * ref names use os.path.basename + ntpath.basename (AG 0208Z: Windows F:\\ paths kept full).
  * importable scan() so video_craft_qc can call it (--crop-reuse candidate wrapper).
  * --shots T0,T1,... gives a per-shot reuse breakdown (what the v08 seat did by hand).
  * --allow REF:A-B (repeatable) marks hits whose matched ref timecode is inside [A,B] as ALLOWED
    (policy-disclosed source, e.g. a ruled living-eye take). Allowed seconds are reported separately and
    do not count toward FAIL. Default: no allowances. Never filename-only: the window is explicit.
  * per-ref seconds, cand/ref sha256 pins in the report.
v01.2 changes vs v01.1 (8cdc0a5f), tool gap T1 (9:16 candidate blind against 16:9 refs):
  * cross-aspect template sizing. v01.1 sized the template from the REF frame (tw=W*s, th=H_ref*s) and
    squashed a 9:16 candidate into a 16:9 box, so a vertical centre/side crop could never line up
    (v08r2 9:16 = 0.00 s, max grad 0.18). v01.2 fits the candidate into the ref box by its OWN aspect
    (contain), then scales by s, and slides it over the ref in both axes. A 9:16 slice of a 16:9 shot is
    found at s=1.0 height with any x offset; a 16:9 cand vs a 9:16 ref works the same way (width-fit).
  * --xw N (default 480): cross-aspect pairs match at ref width N instead of 240 so the vertical slice
    template is not starved (~150x270 px at s=1 instead of 76x135). Same-aspect pairs keep W=240 and
    the v01.1 code path byte-for-byte, so same-aspect rows are identical to v01.1 (selfcheck T3/T4).
  * report rows carry 'xa' (True = cross-aspect match) and the report has 'cross_aspect_refs'.
  * cross-aspect run support: an xa row counts as a hit only if grad >= --thr AND a neighbouring
    sampled frame (t +- 1/cfps) is also an xa row >= --thr on the same ref with |dtc| <= --xa-dtc
    (default 1.5 s). Reason: the vertical-slice template is small, and a single-frame 0.30 false hit
    was seen (v08r2 9:16 t=7.0 palace roofs vs cmp3 cathedral, checked by eye). Isolated xa frames
    >= --thr are listed in 'xa_single' (info) and do not count. Known cost: a 0.5 s single-frame true
    reuse is missed (planted tour 31.5 s slice, xn1). Same-aspect rows are unaffected.
v01.3 changes vs v01.2 (f309f3ed), tool gap T1b (reframed / partial-overlap 9:16 missed):
  * T1b feature pass (SIFT 1000 kp on hist-equalised gray, Lowe ratio 0.75, RANSAC similarity
    estimateAffinePartial2D 4 px; valid only if 0.25<=scale<=5, |angle|<=10 deg). Catches zooms past the
    template range (s<0.50), small rotations and frames whose content runs outside the ref frame
    (partial overlap). Runs on cross-aspect refs only by default (--t1b-all adds same-aspect refs), so
    same-aspect rows stay identical to v01.2/v01.1/v01. --no-t1b turns it off (= v01.2 output).
    A T1b frame counts if inliers >= --t1b-inl (default 20) AND inlier spread >= --t1b-spread
    (default 0.02 of the cand frame) AND a neighbouring sampled frame is also a T1b hit on the same
    ref with |dtc| <= --xa-dtc and scale ratio within 0.75..1.33 (run support, like xa).
  * --twin OTHER_ASPECT.mp4: twin-chain mode. AG delivers 16:9 + 9:16 renders of one cut. The twin is
    scanned against the refs (template path), each cand frame is feature-matched to the twin at the
    SAME time (+-0.5 s, --twin-dt), and a cand frame inherits the twin's counted hit (ref and ref tc
    inherited, so --allow windows still apply). Reported as hit_via='twin'. Catches a 9:16 render
    whose camera/FOV differs from the 16:9 cut but is the same footage (v08r2 S6).
  * rows carry hit_via (tmpl|t1b|twin) and t1b{ref,tc,inl,scale,angle,spread}; report adds t1b_single,
    t1b_params, twin, twin_reuse_sec, max_nonhit_t1b_inl.
usage: crop_reuse_scan.py CAND.mp4 --ref a.mp4 [--ref b.mp4 ...] [--cfps 2] [--rfps 4] [--shots 0,6,8.25]
       [--allow cmp1.mp4:2.0-3.5] [--out report.json]
exit 0 = counted reuse < --max-sec (default 0.5 s), 1 = FAIL."""
import cv2, numpy as np, json, argparse, sys, hashlib, os, ntpath
from multiprocessing import Pool
VERSION='crop_reuse_scan v01.3'
W=240
def base(p): return ntpath.basename(os.path.basename(p))
def sha256(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1<<20),b''): h.update(b)
    return h.hexdigest()
def sample(path,fps,w=None):
    w=w or W
    cap=cv2.VideoCapture(path); vf=cap.get(cv2.CAP_PROP_FPS) or 24.0; out=[]; i=0; nxt=0.0; step=vf/fps
    while True:
        ok,f=cap.read()
        if not ok: break
        if i>=nxt-1e-6:
            h=int(round(f.shape[0]*w/f.shape[1])); out.append((i/vf,cv2.resize(f,(w,h),interpolation=cv2.INTER_AREA))); nxt+=step
        i+=1
    return out
def aspect(path):
    cap=cv2.VideoCapture(path); w=cap.get(cv2.CAP_PROP_FRAME_WIDTH); h=cap.get(cv2.CAP_PROP_FRAME_HEIGHT); cap.release()
    return h/w if w else 0.0
def same_aspect(a,b,tol=0.02): return abs(a-b)<=tol*max(a,b)
def norm(b): return cv2.equalizeHist(cv2.cvtColor(b,cv2.COLOR_BGR2GRAY)).astype(np.float32)
def grad(g): return cv2.magnitude(cv2.Sobel(g,cv2.CV_32F,1,0),cv2.Sobel(g,cv2.CV_32F,0,1))
SC=[round(x,2) for x in np.arange(0.50,1.001,0.05)]
REFS=None
XREFS=None
def init(refs,xrefs=None):
    global REFS,XREFS; REFS=refs; XREFS=xrefs or {}
def xmatch(g,gg,frames,name,best):
    """cross-aspect: contain-fit cand (own aspect) into ref box, scale s, slide both axes."""
    hc,wc=g.shape
    for tc,G,GG in frames:
        H,WR=G.shape
        k=min(WR/wc,H/hc)
        for s in SC:
            tw=max(8,int(wc*k*s)); th=max(8,int(hc*k*s))
            if tw>WR or th>H: continue
            T=cv2.resize(g,(tw,th),interpolation=cv2.INTER_AREA)
            m=cv2.matchTemplate(G,T,cv2.TM_CCOEFF_NORMED); _,r,_,loc=cv2.minMaxLoc(m); r=float(r)
            if r<best[0]-0.15: continue
            TG=cv2.resize(gg,(tw,th),interpolation=cv2.INTER_AREA)
            rg=float(cv2.matchTemplate(GG[loc[1]:loc[1]+th,loc[0]:loc[0]+tw],TG,cv2.TM_CCOEFF_NORMED)[0,0])
            if r>best[0]: best=(r,dict(ref=name,tc=round(tc,2),s=s,loc=list(loc),ncc=round(r,4),grad=round(rg,4),xa=True))
    return best
def match(args):
    t,f=args[0],args[1]; fx=args[2] if len(args)>2 else None; g=norm(f); gg=grad(g); best=(-1.0,None)
    if XREFS:
        gx=norm(fx); ggx=grad(gx)
        for name,frames in XREFS.items(): best=xmatch(gx,ggx,frames,name,best)
    for name,frames in REFS.items():
        for tc,G,GG in frames:
            H=G.shape[0]
            for s in SC:
                tw=int(W*s); th=int(H*s)
                if s>=1.0:
                    T=cv2.resize(g,(W,H)); TG=cv2.resize(gg,(W,H)); loc=(0,0)
                    r=float(cv2.matchTemplate(G,T,cv2.TM_CCOEFF_NORMED).max())
                else:
                    T=cv2.resize(g,(tw,th),interpolation=cv2.INTER_AREA)
                    m=cv2.matchTemplate(G,T,cv2.TM_CCOEFF_NORMED); _,r,_,loc=cv2.minMaxLoc(m); r=float(r)
                    TG=cv2.resize(gg,(tw,th),interpolation=cv2.INTER_AREA)
                if r<best[0]-0.15: continue   # cheap prune on eq-NCC
                rg=float(cv2.matchTemplate(GG[loc[1]:loc[1]+th if s<1 else H, loc[0]:loc[0]+tw if s<1 else W],TG,cv2.TM_CCOEFF_NORMED)[0,0]) if s<1 else float(cv2.matchTemplate(GG,TG,cv2.TM_CCOEFF_NORMED).max())
                if r>best[0]: best=(r,dict(ref=name,tc=round(tc,2),s=s,loc=list(loc),ncc=round(r,4),grad=round(rg,4)))
    return dict(t=round(t,3),**best[1])
SIFT=None; BF=None; FREFS=None
def _init_feat():
    global SIFT,BF
    if SIFT is None: SIFT=cv2.SIFT_create(nfeatures=1000); BF=cv2.BFMatcher(cv2.NORM_L2)
def feats(g):
    _init_feat(); kp,d=SIFT.detectAndCompute(g,None)
    return (np.float32([k.pt for k in kp]) if kp else np.zeros((0,2),np.float32)), d
def fmatch(P,D,shape,frames,name,ratio=0.75,rpx=4.0,smin=0.25,smax=5.0,amax=10.0,tlock=None,t=None):
    """best valid similarity (inliers) of cand features vs every ref frame of one ref."""
    _init_feat(); best=None
    if D is None or len(D)<8: return None
    for tc,PR,DR in frames:
        if tlock is not None and abs(tc-t)>tlock: continue
        if DR is None or len(DR)<8: continue
        m=BF.knnMatch(D,DR,k=2); good=[x[0] for x in m if len(x)==2 and x[0].distance<ratio*x[1].distance]
        if len(good)<8: continue
        src=P[[a.queryIdx for a in good]]; dst=PR[[a.trainIdx for a in good]]
        M,inl=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=rpx)
        if M is None: continue
        sc=float(np.hypot(M[0,0],M[1,0])); ang=float(np.degrees(np.arctan2(M[1,0],M[0,0])))
        if not (smin<=sc<=smax and abs(ang)<=amax): continue
        q=src[inl.ravel()>0]
        if len(q)<3: continue
        spread=float(np.ptp(q[:,0])*np.ptp(q[:,1])/(shape[0]*shape[1]))
        ni=int(inl.sum())
        if best is None or ni>best['inl']:
            best=dict(ref=name,tc=round(tc,2),inl=ni,good=len(good),scale=round(sc,3),angle=round(ang,1),spread=round(spread,3))
    return best
FW=640
def fsample(path,fps):
    """feature frames: long side 640 px, eq gray, (t, pts, desc)."""
    cap=cv2.VideoCapture(path); vf=cap.get(cv2.CAP_PROP_FPS) or 24.0; out=[]; i=0; nxt=0.0; step=vf/fps
    while True:
        ok,f=cap.read()
        if not ok: break
        if i>=nxt-1e-6:
            h,w=f.shape[:2]; k=FW/max(h,w); g=norm(cv2.resize(f,(int(round(w*k)),int(round(h*k))),interpolation=cv2.INTER_AREA)).astype(np.uint8)
            P,D=feats(g); out.append((i/vf,P,D,g.shape)); nxt+=step
        i+=1
    return out
def finit(frefs):
    global FREFS; FREFS=frefs
def fwork(args):
    t,P,D,shape,tlock=args; best=None
    for name,frames in FREFS.items():
        b=fmatch(P,D,shape,[(tc,PR,DR) for tc,PR,DR,_ in frames],name,tlock=tlock,t=t)
        if b and (best is None or b['inl']>best['inl']): best=b
    return best
def fpass(cand_feats,frefs,procs,tlock=None):
    with Pool(procs,initializer=finit,initargs=(frefs,)) as p:
        return p.map(fwork,[(t,P,D,sh,tlock) for t,P,D,sh in cand_feats],chunksize=1)
def fsupport(res,i,inl,spread,dtc,dt):
    r=res[i]
    if not r or r['inl']<inl or r['spread']<spread: return False
    for j in (i-1,i+1):
        if 0<=j<len(res) and res[j] and res[j]['inl']>=inl and res[j]['spread']>=spread and res[j]['ref']==r['ref'] \
           and abs(res[j]['tc']-r['tc'])<=dtc and 0.75<=res[j]['scale']/r['scale']<=1.33: return True
    return False
def parse_allow(items):
    out=[]
    for it in items or []:
        ref,_,win=it.rpartition(':'); a,_,b=win.partition('-')
        if not ref or not b: raise ValueError(f'--allow wants REF:A-B, got {it!r}')
        out.append((base(ref),float(a),float(b)))
    return out
def spans_of(rows,dt):
    spans=[]
    for r in rows:
        if spans and abs(r['t']-spans[-1][1]-dt)<1e-3: spans[-1][1]=r['t']; spans[-1][2].add(r['ref'])
        else: spans.append([r['t'],r['t'],{r['ref']}])
    return [dict(start=s,end=round(e+dt,3),refs=sorted(rr)) for s,e,rr in spans]
def scan(cand,refs,cfps=2,rfps=4,thr=0.30,max_sec=0.5,procs=4,shots=None,allow=None,pins=True,xw=480,xa_dtc=1.5,
         t1b=True,t1b_all=False,t1b_inl=20,t1b_spread=0.02,twin=None,twin_dt=0.5):
    allow=parse_allow(allow) if allow and isinstance(allow[0],str) else (allow or [])
    R={}; X={}; ac=aspect(cand)
    for r in refs:
        if same_aspect(aspect(r),ac):
            fr=sample(r,rfps); R[base(r)]=[(t,norm(f),grad(norm(f))) for t,f in fr]
        else:
            fr=sample(r,rfps,xw); X[base(r)]=[(t,norm(f),grad(norm(f))) for t,f in fr]
    cf=sample(cand,cfps)
    if X:
        cx=sample(cand,cfps,xw); cf=[(t,f,fx) for (t,f),(_,fx) in zip(cf,cx)]
    with Pool(procs,initializer=init,initargs=(R,X)) as p: res=p.map(match,cf,chunksize=1)
    dt=1.0/cfps
    for i,r in enumerate(res):
        r['hit']=r['grad']>=thr
        if r.get('xa') and r['hit']:
            nb=[res[j] for j in (i-1,i+1) if 0<=j<len(res)]
            r['xa_support']=any(n.get('xa') and n['grad']>=thr and n['ref']==r['ref'] and abs(n['tc']-r['tc'])<=xa_dtc and abs(abs(n['t']-r['t'])-dt)<1e-3 for n in nb)
    xa_single=[dict(t=r['t'],ref=r['ref'],tc=r['tc'],grad=r['grad']) for r in res if r.get('xa') and r['hit'] and not r['xa_support']]
    for r in res:
        if r.get('xa') and r['hit'] and not r['xa_support']: r['hit']=False
        if r['hit']: r['hit_via']='tmpl'
    t1b_single=[]; fr_refs=[r for r in refs if base(r) in X or t1b_all] if t1b else []
    cfeat=None
    if fr_refs or twin:
        cfeat=fsample(cand,cfps)[:len(res)]
    if fr_refs:
        fres=fpass(cfeat,{base(r):fsample(r,rfps) for r in fr_refs},procs)
        for i,r in enumerate(res):
            r['t1b']=fres[i]
            if fres[i] and fres[i]['inl']>=t1b_inl and fres[i]['spread']>=t1b_spread:
                if fsupport(fres,i,t1b_inl,t1b_spread,xa_dtc,dt):
                    if not r['hit']: r.update(hit=True,hit_via='t1b',ref=fres[i]['ref'],tc=fres[i]['tc'])
                elif not r['hit']: t1b_single.append(dict(t=r['t'],**fres[i]))
    twin_info=None
    if twin:
        tw=scan(twin,refs,cfps,rfps,thr,max_sec,procs,None,allow,pins=False,xw=xw,xa_dtc=xa_dtc,t1b=t1b,t1b_all=t1b_all,t1b_inl=t1b_inl,t1b_spread=t1b_spread)
        trows={round(x['t'],3):x for x in tw['rows']}
        tm=fpass(cfeat,{base(twin):fsample(twin,rfps)},procs,tlock=twin_dt)
        for i,r in enumerate(res):
            r['twin']=tm[i]
            if r['hit'] or not fsupport(tm,i,t1b_inl,t1b_spread,twin_dt*2,dt): continue
            tt=min(trows,key=lambda k:abs(k-tm[i]['tc']))
            x=trows[tt]
            if abs(tt-tm[i]['tc'])<=dt and x['hit']:
                r.update(hit=True,hit_via='twin',ref=x['ref'],tc=x['tc'],twin_t=tt)
        twin_info=dict(twin=base(twin),twin_reuse_sec=tw['reuse_sec'],twin_spans=tw['spans'],twin_dt=twin_dt,
                       mapped_frames=sum(1 for i in range(len(res)) if fsupport(tm,i,t1b_inl,t1b_spread,twin_dt*2,dt)))
        if pins: twin_info['twin_sha256']=sha256(twin)
    for r in res:
        r['allowed']=bool(r['hit'] and any(r['ref']==ar and a-1e-6<=r['tc']<=b+1e-6 for ar,a,b in allow))
    hit=[r for r in res if r['hit']]; cnt=[r for r in hit if not r['allowed']]; alw=[r for r in hit if r['allowed']]
    sec=len(cnt)*dt
    per_ref={k:round(sum(dt for r in cnt if r['ref']==k),2) for k in list(R)+list(X)}
    out=dict(tool=VERSION,cand=cand,cand_name=base(cand),refs=[base(r) for r in refs],thr=thr,cfps=cfps,rfps=rfps,
             cross_aspect_refs=sorted(X),xw=xw if X else None,xa_dtc=xa_dtc if X else None,xa_single=xa_single,frames=len(res),duration_sampled=round(len(res)*dt,2),reuse_frames=len(cnt),reuse_sec=round(sec,2),
             allowed_sec=round(len(alw)*dt,2),allow=[dict(ref=a,tc_from=b,tc_to=c) for a,b,c in allow],
             per_ref_sec=per_ref,spans=spans_of(cnt,dt),allowed_spans=spans_of(alw,dt),
             max_nonhit_grad=max([r['grad'] for r in res if not r['hit'] and not (r.get('xa') and r['grad']>=thr)] or [0]),
             t1b_params=dict(on=bool(fr_refs),refs=[base(r) for r in fr_refs],inl=t1b_inl,spread=t1b_spread) if t1b else dict(on=False),t1b_single=t1b_single,
             max_nonhit_t1b_inl=max([r['t1b']['inl'] for r in res if not r['hit'] and r.get('t1b')] or [0]),twin=twin_info,
             hit_via={v:sum(1 for r in cnt if r.get('hit_via')==v) for v in ('tmpl','t1b','twin')},
             min_hit_grad=min([r['grad'] for r in hit] or [0]),max_sec=max_sec,
             verdict='FAIL' if sec>=max_sec else 'PASS')
    if pins: out['pins']={base(p):sha256(p) for p in [cand]+list(refs)}
    if shots:
        b=sorted(set([float(x) for x in shots]))
        end=out['duration_sampled']
        if not b or b[0]>0: b=[0.0]+b
        if b[-1]<end: b=b+[end]
        out['per_shot']=[dict(shot=i+1,start=b[i],end=b[i+1],
            reuse_sec=round(sum(dt for r in cnt if b[i]-1e-6<=r['t']<b[i+1]-1e-6),2),
            allowed_sec=round(sum(dt for r in alw if b[i]-1e-6<=r['t']<b[i+1]-1e-6),2),
            refs=sorted({r['ref'] for r in cnt if b[i]-1e-6<=r['t']<b[i+1]-1e-6})) for i in range(len(b)-1)]
    out['rows']=res
    return out
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('cand'); ap.add_argument('--ref',action='append',required=True)
    ap.add_argument('--cfps',type=float,default=2); ap.add_argument('--rfps',type=float,default=4)
    ap.add_argument('--thr',type=float,default=0.30); ap.add_argument('--max-sec',type=float,default=0.5)
    ap.add_argument('--out',default='crop_reuse_report.json'); ap.add_argument('--procs',type=int,default=4)
    ap.add_argument('--shots',default=None,help='comma list of shot start times (s)')
    ap.add_argument('--allow',action='append',default=[],help='REF:A-B ref timecode window ruled allowed')
    ap.add_argument('--xw',type=int,default=480,help='working width for cross-aspect ref/cand pairs')
    ap.add_argument('--xa-dtc',type=float,default=1.5,help='max ref-tc jump between supporting xa frames')
    ap.add_argument('--no-t1b',action='store_true',help='disable T1b feature pass (= v01.2)')
    ap.add_argument('--t1b-all',action='store_true',help='T1b also on same-aspect refs')
    ap.add_argument('--t1b-inl',type=int,default=20); ap.add_argument('--t1b-spread',type=float,default=0.02)
    ap.add_argument('--twin',default=None,help='other-aspect render of the same cut (twin-chain mode)')
    ap.add_argument('--twin-dt',type=float,default=0.5)
    a=ap.parse_args()
    shots=[float(x) for x in a.shots.split(',') if x.strip()] if a.shots else None
    out=scan(a.cand,a.ref,a.cfps,a.rfps,a.thr,a.max_sec,a.procs,shots,a.allow,xw=a.xw,xa_dtc=a.xa_dtc,
             t1b=not a.no_t1b,t1b_all=a.t1b_all,t1b_inl=a.t1b_inl,t1b_spread=a.t1b_spread,twin=a.twin,twin_dt=a.twin_dt)
    with open(a.out,'w',encoding='utf-8') as fh: json.dump(out,fh,indent=1)
    print(f"{VERSION} {out['cand_name']}: reuse {out['reuse_sec']:.2f}s (allowed {out['allowed_sec']:.2f}s) of {out['duration_sampled']:.1f}s  "
          f"spans={out['spans']}  max_nonhit_grad={out['max_nonhit_grad']} min_hit_grad={out['min_hit_grad']} -> {out['verdict']}"+(f"  xa_refs={out['cross_aspect_refs']} xa_single={[(x['t'],x['ref'],x['grad']) for x in out['xa_single']]}" if out['cross_aspect_refs'] else ''))
    print(f"  hit_via={out['hit_via']} t1b_single={[(x['t'],x['ref'],x['inl']) for x in out['t1b_single']]} max_nonhit_t1b_inl={out['max_nonhit_t1b_inl']}"+(f" twin={out['twin']['twin']} twin_reuse={out['twin']['twin_reuse_sec']} mapped={out['twin']['mapped_frames']}" if out['twin'] else ''))
    for s in out.get('per_shot',[]): print(f"  S{s['shot']} {s['start']}-{s['end']}: reuse {s['reuse_sec']} s allowed {s['allowed_sec']} s {s['refs']}")
    sys.exit(1 if out['verdict']=='FAIL' else 0)
if __name__=='__main__': main()
