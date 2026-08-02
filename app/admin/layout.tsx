import type { Metadata, Viewport } from 'next';
import AdminShell from './AdminShell';

export const metadata: Metadata = {
  title: 'Projetar Conforto — Staff',
  manifest: '/admin/manifest.webmanifest',
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PC Staff',
  },
};

export const viewport: Viewport = {
  themeColor: '#18191c',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
