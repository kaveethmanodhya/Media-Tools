'use client';

import React, {useEffect, useState} from 'react';
import {Crop, Download, Maximize2, UploadCloud, RotateCcw} from 'lucide-react';
import {baseName, canvasBlob, downloadBlob, drawContain, extensionFor, makeCanvas, readImage, type ExportImageFormat} from '@/lib/additionalMedia';

function useLocalPreview(file: File | null) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) { setUrl(''); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function ImagePicker({onChange}: {onChange: (f: File) => void}) {
  return <label className="extra-picker">
    <UploadCloud size={26} aria-hidden="true"/>
    <strong>Select an image</strong>
    <span>JPEG, PNG, WebP, GIF, or BMP. Files stay on your device.</span>
    <input type="file" accept="image/*" onChange={e => {
      const file = e.target.files?.[0];
      if (file) onChange(file);
      e.currentTarget.value = '';
    }}/>
  </label>;
}

const formats: {label: string; value: ExportImageFormat}[] = [
  {label:'PNG',value:'image/png'},
  {label:'JPEG',value:'image/jpeg'},
  {label:'WebP',value:'image/webp'}
];

export function CropResizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [dimensions, setDimensions] = useState({w:0,h:0});
  const [rect, setRect] = useState({x:0,y:0,w:100,h:100});
  const [outputWidth, setOutputWidth] = useState(1080);
  const [format, setFormat] = useState<ExportImageFormat>('image/png');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const src = useLocalPreview(file);
  useEffect(() => {
    if (!file) return;
    let active = true;
    readImage(file).then(img => {
      if (!active) return;
      setDimensions({w:img.naturalWidth,h:img.naturalHeight});
      setOutputWidth(img.naturalWidth);
      setRect({x:0,y:0,w:100,h:100});
      setError('');
    }).catch(e => {if(active)setError(String(e));});
    return () => {active=false;};
  }, [file]);
  const setR = (field: 'x'|'y'|'w'|'h', n: number) => {
    setRect(r => {
      const next = {...r, [field]:n};
      next.w = Math.min(100,Math.max(1,next.w));
      next.h = Math.min(100,Math.max(1,next.h));
      next.x = Math.min(100-next.w,Math.max(0,next.x));
      next.y = Math.min(100-next.h,Math.max(0,next.y));
      return next;
    });
  };
  const preset = (ratio: number | null) => {
    if (!ratio || !dimensions.w) {setRect({x:0,y:0,w:100,h:100});return;}
    const srcRatio = dimensions.w / dimensions.h;
    const w = ratio < srcRatio ? ratio/srcRatio*100 : 100;
    const h = ratio > srcRatio ? srcRatio/ratio*100 : 100;
    setRect({x:(100-w)/2,y:(100-h)/2,w,h});
  };
  const cropW = Math.max(1,Math.round(dimensions.w*rect.w/100));
  const cropH = Math.max(1,Math.round(dimensions.h*rect.h/100));
  const outH = Math.round(outputWidth*cropH/cropW);
  const process = async () => {
    if (!file || !dimensions.w) return;
    if (outputWidth < 1 || outH < 1 || outputWidth*outH > 32_000_000 || outputWidth > 8192 || outH > 8192) {
      setError('Output is too large. Keep each side under 8192px and total pixels under 32 million.');return;
    }
    setBusy(true);setError('');
    try {
      const img = await readImage(file);
      const canvas = makeCanvas(outputWidth,outH);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available.');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (format === 'image/jpeg') {ctx.fillStyle = '#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
      ctx.drawImage(img,Math.round(dimensions.w*rect.x/100),Math.round(dimensions.h*rect.y/100),cropW,cropH,0,0,canvas.width,canvas.height);
      downloadBlob(await canvasBlob(canvas,format),baseName(file.name)+'-cropped.'+extensionFor(format));
    } catch(e) {setError(e instanceof Error?e.message:'Crop failed.');}
    finally {setBusy(false);}
  };
  return <div className="extra-tool">
    <div className="extra-tool-heading"><Crop size={22}/><div><h2>Image Crop & Resize</h2><p>Choose a crop region and output width, then export a new image.</p></div></div>
    <div className="extra-layout">
      <div className="extra-panel extra-controls">
        <ImagePicker onChange={setFile}/>
        <div className="extra-field"><label>Aspect ratio preset</label><div className="extra-button-row">
          {[{label:'Free',ratio:null},{label:'1:1',ratio:1},{label:'4:3',ratio:4/3},{label:'16:9',ratio:16/9},{label:'9:16',ratio:9/16}].map(p=>
            <button className="extra-option" key={p.label} disabled={!dimensions.w} onClick={()=>preset(p.ratio)}>{p.label}</button>)}
        </div></div>
        {([['x','Left position'],['y','Top position'],['w','Crop width'],['h','Crop height']] as const).map(([field,label])=>
          <div className="extra-field" key={field}>
            <label htmlFor={'crop-'+field}>{label}: {Math.round(rect[field])}%</label>
            <input id={'crop-'+field} type="range" min={0} max={field==='x'?100-rect.w:field==='y'?100-rect.h:100} step={1} value={rect[field]} onChange={e=>setR(field,Number(e.target.value))} disabled={!file}/>
          </div>)}
        <div className="extra-field"><label htmlFor="crop-out-width">Export width in pixels</label><input id="crop-out-width" type="number" min="1" max="8192" value={outputWidth} onChange={e=>setOutputWidth(Number(e.target.value))} disabled={!file}/><small>Height adjusts automatically: {outH}px</small></div>
        <div className="extra-field"><label htmlFor="crop-format">Export format</label><select id="crop-format" value={format} onChange={e=>setFormat(e.target.value as ExportImageFormat)}>{formats.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
        <button className="btn btn-primary" onClick={process} disabled={!file || !dimensions.w || busy}><Download size={16}/> {busy?'Processing…':'Download cropped image'}</button>
        {error&&<p className="extra-error" role="alert">{error}</p>}
      </div>
      <div className="extra-panel extra-preview">
        {src?<><div className="extra-preview-image"><img src={src} alt="Original image with selected crop rectangle"/><div className="extra-crop-box" style={{left:rect.x+'%',top:rect.y+'%',width:rect.w+'%',height:rect.h+'%'}}/></div><p>{dimensions.w} × {dimensions.h} original · {cropW} × {cropH} selected</p></>:<div className="extra-empty">Upload an image to preview the crop.</div>}
      </div>
    </div>
  </div>;
}

export { ImageUpscalerTool } from './ImageUpscalerTool';

