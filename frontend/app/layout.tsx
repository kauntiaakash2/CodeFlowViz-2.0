import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodeFlowViz 2.0',
  description: 'Interactive cockpit for visual code execution flow.',
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