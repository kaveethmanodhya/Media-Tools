'use client';
import {useCallback,useEffect,useState} from 'react';
import {Download,UsersRound} from 'lucide-react';
type Metrics={available:boolean;visitors?:number;downloads?:number};
const fmt=(n:number)=>new Intl.NumberFormat('en-US').format(n);
export function UsageCounters(){
  const [metrics,setMetrics]=useState<Metrics|null>(null);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    try {
      const r=await fetch('/api/usage',{cache:'no-store'});
      const v:Metrics=await r.json();
      setMetrics(r.ok&&v.available?v:{available:false});
    }catch{setMetrics({available:false});}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    void refresh();
    const change=()=>{void refresh();};
    window.addEventListener('mediatools:usage-changed',change);
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);
    return()=>{window.removeEventListener('mediatools:usage-changed',change);window.clearInterval(timer);};
  },[refresh]);
  const ok=metrics?.available===true;
  return <section className="usage-counters" aria-label="MediaTools community statistics">
    <div className="usage-counter"><UsersRound size={23}/><div><span>Total Visitors</span><strong>{ok?fmt(metrics.visitors??0):'—'}</strong><small>Approx. unique browsers</small></div></div>
    <div className="usage-counter"><Download size={23}/><div><span>Total Downloads</span><strong>{ok?fmt(metrics.downloads??0):'—'}</strong><small>Recorded download actions</small></div></div>
    <p className="usage-counters-caption">{loading?'Loading community stats…':ok?'Counts start when tracking is enabled · Updated automatically':'Community stats are unavailable until storage is configured.'}</p>
  </section>;
}
