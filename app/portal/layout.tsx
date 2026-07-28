import type { Metadata, Viewport } from 'next';
import PortalShell from './PortalShell';

export const metadata: Metadata = {
  title: 'Projetar Conforto',
  manifest: '/portal/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Projetar Conforto',
  },
};

export const viewport: Viewport = {
  themeColor: '#7c4324',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
