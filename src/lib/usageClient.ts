/** Count download actions without interrupting file downloads. */
export function recordDownload(): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/usage', {
      method:'POST', headers:{'Content-Type':'application/json'},
      credentials:'same-origin',cache:'no-store',keepalive:true,
      body:JSON.stringify({event:'download'})
    }).then(r=>{if(r.ok)window.dispatchEvent(new Event('mediatools:usage-changed'));}).catch(()=>{});
  } catch { /* Usage reporting must never block a download. */ }
}
