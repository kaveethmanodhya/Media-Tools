import type { Metadata } from 'next';
import { ImagesToPdfTool } from '@/components/DocumentAnimationTools';
export const metadata: Metadata = { title: 'Image to PDF', description: 'Image to PDF using private browser-side processing on MediaTools.' };
export default function Page() {
 return <><header className="page-header"><h1 className="page-title">Image to PDF</h1><p className="page-subtitle">Private, local media processing · No file uploads</p></header><main className="page-body"><ImagesToPdfTool/></main></>;
}
