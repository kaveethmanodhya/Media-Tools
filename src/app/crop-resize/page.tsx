import type { Metadata } from 'next';
import { CropResizeTool } from '@/components/CanvasTools';
export const metadata: Metadata = { title: 'Image Crop & Resize', description: 'Image Crop & Resize using private browser-side processing on MediaTools.' };
export default function Page() {
 return <><header className="page-header"><h1 className="page-title">Image Crop & Resize</h1><p className="page-subtitle">Private, local media processing · No file uploads</p></header><main className="page-body"><CropResizeTool/></main></>;
}
