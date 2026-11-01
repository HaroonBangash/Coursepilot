import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CoursePilot AI — Note-Grounded MSc Assistant',
  description: 'A trustworthy, citation-aware academic assistant for MSc course notes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="site-glow" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
