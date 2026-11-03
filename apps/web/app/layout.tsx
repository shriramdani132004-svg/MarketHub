import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'MarketHub — Multi-vendor marketplace',
    template: '%s · MarketHub',
  },
  description:
    'MarketHub is a multi-vendor e-commerce platform with real transactional inventory, seller-wise order splitting and simulated payments.',
  applicationName: 'MarketHub',
  keywords: ['marketplace', 'e-commerce', 'multi-vendor', 'Next.js', 'NestJS'],
};

export const viewport: Viewport = {
  themeColor: '#172554',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
