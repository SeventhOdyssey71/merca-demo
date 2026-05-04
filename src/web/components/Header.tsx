export type TabKey = 'overview' | 'read' | 'transact' | 'activity';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'read', label: 'Read' },
  { key: 'transact', label: 'Transact' },
  { key: 'activity', label: 'Activity' },
];

export function Header({
  tab,
  onTab,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
}) {
  return (
    <header className="app-header spread">
      <div className="row" style={{ gap: 12 }}>
        <span className="brand">merca.earth</span>
        <span className="tag">integration demo</span>
      </div>
      <nav>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={t.key === tab ? 'active' : ''}
            onClick={() => onTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
