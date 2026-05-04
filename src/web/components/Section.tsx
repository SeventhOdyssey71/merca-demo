import type { ReactNode } from 'react';

export function Section({
  title,
  blurb,
  children,
}: {
  title: ReactNode;
  blurb?: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <header>
        <h2>{title}</h2>
        {blurb && <p>{blurb}</p>}
      </header>
      {children}
    </section>
  );
}
