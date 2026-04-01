import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tealium + LaunchDarkly Integration Demo',
  description: 'Demo app to simulate Tealium + LaunchDarkly integration traffic',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
