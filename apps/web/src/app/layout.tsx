import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientLayout from '../components/ClientLayout';
import SmoothScroller from '../components/SmoothScroller';

export const metadata: Metadata = {
  title: 'QueueWatch | BullMQ Observability Platform',
  description: 'AI-powered observability and reliability analytics for BullMQ background systems.',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased min-h-screen">
        <SmoothScroller />
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
