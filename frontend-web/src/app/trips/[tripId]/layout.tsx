import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trip | Trip Tally',
};

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
