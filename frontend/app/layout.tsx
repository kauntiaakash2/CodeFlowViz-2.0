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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
