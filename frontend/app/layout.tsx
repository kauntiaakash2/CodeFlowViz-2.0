import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://code-flow-viz-2-0.vercel.app'),
  title: 'CodeFlowViz 2.0 — Visual JavaScript Execution',
  description:
    'See JavaScript execute step by step with a replayable timeline, variable inspector, and line-level trace.',
  openGraph: {
    title: 'CodeFlowViz 2.0',
    description: 'See JavaScript execute, step by step.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1280,
        height: 640,
        alt: 'CodeFlowViz 2.0 visual JavaScript execution cockpit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeFlowViz 2.0',
    description: 'See JavaScript execute, step by step.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',t||(d?'dark':'light'));}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
