import type { Metadata } from 'next';
import { ImageWatermarkTool } from '@/components/ImageWatermarkTool';
export const metadata: Metadata = { title: 'Image Watermark', description: 'Image Watermark using private browser-side processing on MediaTools.' };
export default function Page() {
 return <><header className="page-header"><h1 className="page-title">Image Watermark</h1><p className="page-subtitle">Private, local media processing · No file uploads</p></header><main className="page-body"><ImageWatermarkTool/></main></>;
}
