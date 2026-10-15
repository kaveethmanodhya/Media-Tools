import type { Metadata } from 'next';
import { ImageUpscalerTool } from '@/components/CanvasTools';
export const metadata: Metadata = { title: 'Image Upscaler', description: 'Image Upscaler using private browser-side processing on MediaTools.' };
export default function Page() {
 return <><header className="page-header"><h1 className="page-title">Image Upscaler</h1><p className="page-subtitle">Private, local media processing · No file uploads</p></header><main className="page-body"><ImageUpscalerTool/></main></>;
}
