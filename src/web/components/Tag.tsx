import type { ReactNode } from 'react';

export function Tag({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'live' | 'warn';
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
