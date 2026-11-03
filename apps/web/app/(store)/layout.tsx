import type { ReactNode } from 'react';
import { StoreShell } from '../../components/layout/StoreShell';

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreShell>{children}</StoreShell>;
}
