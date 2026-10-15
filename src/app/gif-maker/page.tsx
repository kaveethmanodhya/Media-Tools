import type { Metadata } from 'next';
import { GifMakerTool } from '@/components/DocumentAnimationTools';
export const metadata: Metadata = { title: 'GIF Maker', description: 'GIF Maker using private browser-side processing on MediaTools.' };
export default function Page() {
 return <><header className="page-header"><h1 className="page-title">GIF Maker</h1><p className="page-subtitle">Private, local media processing · No file uploads</p></header><main className="page-body"><GifMakerTool/></main></>;
}
