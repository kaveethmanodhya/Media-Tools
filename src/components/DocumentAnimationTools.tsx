'use client';
import React,{useState} from 'react';
import {FileImage,Download,ShieldCheck,UploadCloud} from 'lucide-react';
import {baseName,canvasBlob,createImagePdf,downloadBatch,downloadBlob,drawContain,makeCanvas,readImage,type PdfImagePage} from '@/lib/additionalMedia';
import {createGif} from '@/lib/additionalMedia';

function Picker({multiple=true,onFiles}:{multiple?:boolean;onFiles:(files:File[])=>void}) {
 return <label className="extra-picker"><UploadCloud size={25}/><strong>Choose images</strong><span>JPG, PNG, WebP and browser-supported images</span><input type="file" accept="image/*" multiple={multiple} onChange={e=>{onFiles(Array.from(e.target.files||[]));e.target.value='';}}/></label>;
}
export function ImagesToPdfTool(){
 const [files,setFiles]=useState<File[]>([]),[size,setSize]=useState<'a4'|'letter'|'fit'>('a4'),[margin,setMargin]=useState(24),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generate=async()=>{
  if(!files.length)return;setBusy(true);setError('');
  try{
   const pages:PdfImagePage[]=[];
   for(const file of files){
    const img=await readImage(file);
    const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=makeCanvas(w,h),ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas not available');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    const jpg=await canvasBlob(canvas,'image/jpeg',0.9);
    const pageW=size==='a4'?595:size==='letter'?612:w+2*margin;
    const pageH=size==='a4'?842:size==='letter'?792:h+2*margin;
    pages.push({jpeg:new Uint8Array(await jpg.arrayBuffer()),width:w,height:h,pageW,pageH,margin});
   }
   downloadBlob(createImagePdf(pages),'mediatools-images.pdf');
  }catch(e){setError(e instanceof Error?e.message:'PDF creation failed');}finally{setBusy(false);}
 };
 return <div className="extra-tool"><div className="extra-tool-heading"><FileImage size={22}/><div><h2>Image to PDF</h2><p>Combine images into an ordered, multi-page PDF in your browser.</p></div></div><div className="extra-layout"><div className="extra-panel extra-controls"><Picker onFiles={f=>setFiles(f.slice(0,60))}/><p className="extra-detail">{files.length} image(s) selected. Order follows file selection.</p><div className="extra-field"><label htmlFor="pdf-page">Page size</label><select id="pdf-page" value={size} onChange={e=>setSize(e.target.value as typeof size)}><option value="a4">A4</option><option value="letter">US Letter</option><option value="fit">Fit each image</option></select></div><div className="extra-field"><label htmlFor="pdf-margin">Page margin: {margin} pt</label><input id="pdf-margin" type="range" min="0" max="72" value={margin} onChange={e=>setMargin(+e.target.value)}/></div><button className="btn btn-primary" disabled={!files.length||busy} onClick={generate}><Download size={16}/>{busy?'Creating PDF…':'Download PDF'}</button>{error&&<p className="extra-error" role="alert">{error}</p>}</div><div className="extra-panel extra-preview"><div className="extra-file-list">{files.length?files.map((f,i)=><div key={i} className="extra-file-row"><span>{i+1}. {f.name}</span><button className="extra-text-button" onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))}>Remove</button></div>):<div className="extra-empty">Selected pages will appear here.</div>}</div></div></div></div>;
}
export function MetadataCleanerTool(){
 const [files,setFiles]=useState<File[]>([]),[format,setFormat]=useState<'image/png'|'image/jpeg'|'image/webp'>('image/png'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const clean=async()=>{
  setBusy(true);setError('');
  try{
   const outputs=[];
   for(const file of files){
    const image=await readImage(file);
    if(image.naturalWidth*image.naturalHeight>32_000_000)throw Error('An image exceeds 32 megapixels.');
    const c=makeCanvas(image.naturalWidth,image.naturalHeight),ctx=c.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
    if(format==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);}
    ctx.drawImage(image,0,0);
    const ext=format==='image/jpeg'?'jpg':format.split('/')[1];
    outputs.push({name:baseName(file.name)+'-clean.'+ext,blob:await canvasBlob(c,format,0.94)});
   }
   await downloadBatch(outputs,'metadata-cleaned.zip');
  }catch(e){setError(e instanceof Error?e.message:'Metadata removal failed');}finally{setBusy(false);}
 };
 return <div className="extra-tool"><div className="extra-tool-heading"><ShieldCheck size={22}/><div><h2>Image Metadata Cleaner</h2><p>Re-encode images without original EXIF, GPS, or camera metadata. Color and encoding may change.</p></div></div><div className="extra-layout"><div className="extra-panel extra-controls"><Picker onFiles={f=>setFiles(f.slice(0,40))}/><p className="extra-detail">{files.length} file(s) selected</p><div className="extra-field"><label htmlFor="clean-format">Export format</label><select id="clean-format" value={format} onChange={e=>setFormat(e.target.value as typeof format)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></div><p className="extra-detail">Each photo is decoded and redrawn on a new canvas. Original metadata is not copied to the output.</p><button className="btn btn-primary" onClick={clean} disabled={!files.length||busy}><Download size={16}/>{busy?'Cleaning…':'Clean & download'}</button>{error&&<p className="extra-error" role="alert">{error}</p>}</div><div className="extra-panel extra-preview"><div className="extra-file-list">{files.length?files.map((f,i)=><div className="extra-file-row" key={i}><span>{f.name}</span><span>{Math.round(f.size/1024)} KB</span></div>):<div className="extra-empty">Choose files to strip their metadata.</div>}</div></div></div></div>;
}
export function GifMakerTool(){
 const [files,setFiles]=useState<File[]>([]),[width,setWidth]=useState(320),[delay,setDelay]=useState(150),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generate=async()=>{
  if(files.length<2)return;setBusy(true);setError('');
  try{
   const imgs=await Promise.all(files.map(readImage));
   const ratio=imgs[0].naturalHeight/imgs[0].naturalWidth;
   const height=Math.max(1,Math.round(width*ratio));
   if(height>512)throw Error('Output height exceeds 512px. Choose a smaller width.');
   const frames=imgs.map(img=>{
    const c=makeCanvas(width,height),ctx=c.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    drawContain(ctx,img,img.naturalWidth,img.naturalHeight,width,height);
    return ctx.getImageData(0,0,width,height);
   });
   downloadBlob(createGif(frames,delay),'mediatools-animation.gif');
  }catch(e){setError(e instanceof Error?e.message:'GIF generation failed');}finally{setBusy(false);}
 };
 return <div className="extra-tool"><div className="extra-tool-heading"><FileImage size={22}/><div><h2>GIF Maker</h2><p>Create a looping animated GIF from up to 40 still images. Local, no upload required.</p></div></div><div className="extra-layout"><div className="extra-panel extra-controls"><Picker onFiles={f=>setFiles(f.slice(0,40))}/><p className="extra-detail">{files.length} frame(s) selected. Minimum 2, maximum 40.</p><div className="extra-field"><label htmlFor="gif-width">GIF width: {width}px</label><input id="gif-width" type="range" min="96" max="512" step="16" value={width} onChange={e=>setWidth(+e.target.value)}/></div><div className="extra-field"><label htmlFor="gif-delay">Frame duration: {delay} ms</label><input id="gif-delay" type="range" min="50" max="1000" step="10" value={delay} onChange={e=>setDelay(+e.target.value)}/></div><p className="extra-detail">Uses a compact 256-color palette. Complex photos may show reduced color fidelity.</p><button className="btn btn-primary" onClick={generate} disabled={files.length<2||busy}><Download size={16}/>{busy?'Generating…':'Download GIF'}</button>{error&&<p className="extra-error" role="alert">{error}</p>}</div><div className="extra-panel extra-preview"><div className="extra-file-list">{files.length?files.map((f,i)=><div className="extra-file-row" key={i}><span>{i+1}. {f.name}</span><button className="extra-text-button" onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))}>Remove</button></div>):<div className="extra-empty">Select a sequence of images in playback order.</div>}</div></div></div></div>;
}
