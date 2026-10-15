import type { Metadata } from 'next';
import { MetadataCleanerTool } from '@/components/DocumentAnimationTools';
export const metadata: Metadata = { title: 'Metadata Cleaner', description: 'Metadata Cleaner using private browser-side processing on MediaTools.' };
export default function Page() {
 return <><header className="page-header"><h1 className="page-title">Metadata Cleaner</h1><p className="page-subtitle">Private, local media processing · No file uploads</p></header><main className="page-body"><MetadataCleanerTool/></main></>;
}
