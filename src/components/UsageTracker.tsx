'use client';
import {useEffect} from 'react';
export function UsageTracker(){
  useEffect(()=>{
    void fetch('/api/usage',{
      method:'POST',headers:{'Content-Type':'application/json'},
      credentials:'same-origin',cache:'no-store',
      body:JSON.stringify({event:'visit'})
    }).then(r=>{if(r.ok)window.dispatchEvent(new Event('mediatools:usage-changed'));}).catch(()=>{});
  },[]);
  return null;
}
