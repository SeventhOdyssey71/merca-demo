import { useState } from 'react';
import { Header, type TabKey } from './components/Header.js';
import { Overview } from './tabs/Overview.js';
import { Read } from './tabs/Read.js';
import { Transact } from './tabs/Transact.js';
import { Activity } from './tabs/Activity.js';

export function App() {
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <div className="shell">
      <Header tab={tab} onTab={setTab} />

      <main key={tab} className="fade-in">
        {tab === 'overview' && <Overview goRead={() => setTab('read')} />}
        {tab === 'read' && <Read />}
        {tab === 'transact' && <Transact />}
        {tab === 'activity' && <Activity />}
      </main>

      <footer className="app-footer">
        <span>
          Demo built against{' '}
          <a href="https://docs.merca.earth/reference/deployed-contracts" target="_blank" rel="noreferrer">
            mainnet contracts
          </a>{' '}
          using <span className="mono">@mysten/sui</span>.
        </span>
        <span className="mono">v0.1.0</span>
      </footer>
    </div>
  );
}
