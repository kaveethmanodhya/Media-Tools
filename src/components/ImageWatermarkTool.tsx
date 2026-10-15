'use client';

import React, {useEffect,useState} from 'react';
import {Stamp,Download,UploadCloud} from 'lucide-react';
import {baseName,canvasBlob,downloadBatch,extensionFor,makeCanvas,readImage,type ExportImageFormat} from '@/lib/additionalMedia';

type Position = 'tl'|'tr'|'center'|'bl'|'br';
const positions: {id:Position;label:string}[] = [
 {id:'tl',label:'Top left'},{id:'tr',label:'Top right'},{id:'center',label:'Center'},{id:'bl',label:'Bottom left'},{id:'br',label:'Bottom right'}
];

export function ImageWatermarkTool() {
  const [files,setFiles]=useState<File[]>([]);
  const [logo,setLogo]=useState<File|null>(null);
  const [text,setText]=useState('© MediaTools');
  const [position,setPosition]=useState<Position>('br');
  const [opacity,setOpacity]=useState(60);
  const [size,setSize]=useState(8);
  const [format,setFormat]=useState<ExportImageFormat>('image/png');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState('');
  useEffect(()=>{
    if(!files[0]){setPreview('');return;}
    const url=URL.createObjectURL(files[0]);setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[files]);
  const process=async()=>{
    if(!files.length || (!text.trim()&&!logo)) {setError('Add images and text or a logo watermark.');return;}
    setBusy(true);setError('');
    try{
      const logoImg=logo?await readImage(logo):null;
      const outputs:{name:string;blob:Blob}[]=[];
      for(const file of files){
        const img=await readImage(file);
        if(img.naturalWidth*img.naturalHeight>32_000_000)throw new Error('One or more images exceed the 32 megapixel processing limit.');
        const canvas=makeCanvas(img.naturalWidth,img.naturalHeight);
        const ctx=canvas.getContext('2d');
        if(!ctx)throw new Error('Canvas is unavailable.');
        if(format==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
        ctx.drawImage(img,0,0);
        ctx.save();
        ctx.globalAlpha=opacity/100;
        const margin=Math.max(12,Math.round(canvas.width*0.025));
        const targetW=Math.max(24,Math.round(canvas.width*size/100));
        const lineHeight=Math.max(18,Math.round(canvas.width*size/100));
        ctx.font='700 '+lineHeight+'px Arial, sans-serif';
        ctx.textBaseline='top';
        const textW=text.trim()?ctx.measureText(text).width:0;
        let markW=logoImg?targetW:textW;
        let markH=logoImg?targetW*logoImg.naturalHeight/logoImg.naturalWidth:lineHeight;
        if(logoImg&&text.trim()){
          markW=Math.max(markW,textW);
          markH+=lineHeight+8;
        }
        const left=position==='center'?(canvas.width-markW)/2:position.endsWith('r')?canvas.width-markW-margin:margin;
        const top=position==='center'?(canvas.height-markH)/2:position.startsWith('b')?canvas.height-markH-margin:margin;
        if(logoImg)ctx.drawImage(logoImg,left,top,targetW,targetW*logoImg.naturalHeight/logoImg.naturalWidth);
        if(text.trim()){
          const ty=top+(logoImg?targetW*logoImg.naturalHeight/logoImg.naturalWidth+8:0);
          ctx.lineWidth=Math.max(2,lineHeight/12);
          ctx.strokeStyle='rgba(0,0,0,0.8)';
          ctx.lineJoin='round';
          ctx.strokeText(text,left,ty);
          ctx.fillStyle='#fff';
          ctx.fillText(text,left,ty);
        }
        ctx.restore();
        outputs.push({name:baseName(file.name)+'-watermarked.'+extensionFor(format),blob:await canvasBlob(canvas,format)});
      }
      await downloadBatch(outputs,'watermarked-images.zip');
    }catch(e){setError(e instanceof Error?e.message:'Watermarking failed.');}
    finally{setBusy(false);}
  };
  return <div className="extra-tool">
    <div className="extra-tool-heading"><Stamp size={22}/><div><h2>Image Watermark</h2><p>Add a text or image watermark to one or more photos without uploading them.</p></div></div>
    <div className="extra-layout">
      <div className="extra-panel extra-controls">
        <label className="extra-picker"><UploadCloud size={24}/><strong>Select images</strong><span>Multiple PNG, JPEG, or WebP files</span><input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=Array.from(e.target.files||[]);setFiles(f.slice(0,30));setError(f.length>30?'Only the first 30 files were added.':'');e.currentTarget.value='';}}/></label>
        {files.length>0&&<p className="extra-detail">{files.length} image(s) ready</p>}
        <div className="extra-field"><label htmlFor="wm-text">Watermark text (optional)</label><input id="wm-text" type="text" value={text} maxLength={100} onChange={e=>setText(e.target.value)}/></div>
        <div className="extra-field"><label htmlFor="wm-logo">Watermark logo (optional)</label><input id="wm-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setLogo(e.target.files?.[0]||null)}/>{logo&&<button className="extra-text-button" onClick={()=>setLogo(null)}>Remove logo ({logo.name})</button>}</div>
        <div className="extra-field"><label htmlFor="wm-pos">Position</label><select id="wm-pos" value={position} onChange={e=>setPosition(e.target.value as Position)}>{positions.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
        <div className="extra-field"><label htmlFor="wm-opacity">Opacity: {opacity}%</label><input type="range" id="wm-opacity" min="10" max="100" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></div>
        <div className="extra-field"><label htmlFor="wm-size">Watermark scale: {size}% of image width</label><input type="range" id="wm-size" min="2" max="25" value={size} onChange={e=>setSize(Number(e.target.value))}/></div>
        <div className="extra-field"><label htmlFor="wm-format">Output format</label><select id="wm-format" value={format} onChange={e=>setFormat(e.target.value as ExportImageFormat)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></div>
        <button className="btn btn-primary" disabled={!files.length||busy} onClick={process}><Download size={16}/>{busy?'Applying watermark…':'Apply & download'+(files.length>1?' ZIP':'')}</button>
        {error&&<p className="extra-error" role="alert">{error}</p>}
      </div>
      <div className="extra-panel extra-preview">
        {preview?<><img className="extra-result-image" src={preview} alt="First source image"/><p>Original image preview. The watermark is applied when you download.</p></>:<div className="extra-empty">Select images to add a watermark.</div>}
      </div>
    </div>
  </div>;
}
