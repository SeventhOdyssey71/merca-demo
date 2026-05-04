import { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getClient } from '@merca/client';
import { decodeMoveAbort } from '@merca/errors';
import { DEFAULT_GAS_BUDGET_MIST } from '@merca/tx';
import { CodeBlock } from './CodeBlock.js';
import { Tag } from './Tag.js';
import { shortAddr } from '@merca/format';

const KEY_STORAGE = 'merca-demo:sui-private-key';

/**
 * Opt-in real signing for the `marks::mark` flow.
 * The private key is held in localStorage only; clear it when you're done.
 */
export function SignPanel({ buildTx }: { buildTx: () => Transaction }) {
  const [keyInput, setKeyInput] = useState<string>(
    () => localStorage.getItem(KEY_STORAGE) ?? '',
  );
  const [persist, setPersist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ digest: string; address: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSign = async () => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const { schema, secretKey } = decodeSuiPrivateKey(keyInput.trim());
      if (schema !== 'ED25519') {
        throw new Error(`only Ed25519 keys are supported (got ${schema})`);
      }
      const kp = Ed25519Keypair.fromSecretKey(secretKey);
      const address = kp.toSuiAddress();

      const tx = buildTx();
      tx.setSender(address);
      // Set an explicit gas budget so the SDK skips its internal estimation
      // dry-run. If the PTB itself aborts, signAndExecute will surface the
      // real Move abort instead of "could not automatically determine a budget".
      tx.setGasBudget(DEFAULT_GAS_BUDGET_MIST);

      const exec = await getClient().signAndExecuteTransaction({
        signer: kp,
        transaction: tx,
        options: { showEffects: true, showEvents: true },
      });

      if (persist) localStorage.setItem(KEY_STORAGE, keyInput);
      setResult({ digest: exec.digest, address });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onClear = () => {
    localStorage.removeItem(KEY_STORAGE);
    setKeyInput('');
    setResult(null);
  };

  return (
    <details className="col" style={{ marginTop: 16 }}>
      <summary
        style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-soft)' }}
      >
        sign &amp; execute on mainnet (opt-in)
      </summary>
      <div className="col" style={{ marginTop: 12 }}>
        <div className="notice">
          Real mainnet transaction. Spends a small amount of SUI from the wallet whose key you
          paste below. The key is held in memory and (optionally) localStorage; never commit
          it. Prefer the Node script <code>scripts/sign-mark-tx.ts</code> with a dedicated dev
          wallet.
        </div>

        <div className="field">
          <label className="label" htmlFor="privkey">
            sui private key (suiprivkey1…)
          </label>
          <input
            id="privkey"
            type="password"
            placeholder="suiprivkey1…"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <div className="row" style={{ gap: 8 }}>
            <label
              className="row"
              style={{ gap: 6, fontSize: 12, color: 'var(--ink-soft)' }}
            >
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
              />
              remember on this browser
            </label>
            <span style={{ flex: 1 }} />
            <button onClick={onClear} disabled={!keyInput && !result}>
              clear
            </button>
            <button
              className="primary"
              onClick={onSign}
              disabled={busy || keyInput.trim().length === 0}
            >
              {busy ? 'signing…' : 'sign & execute'}
            </button>
          </div>
        </div>

        {err && (() => {
          const decoded = decodeMoveAbort(err);
          if (!decoded) return <pre style={{ color: 'var(--warn)' }}>{err}</pre>;
          return (
            <div className="abort">
              <span className="abort-name">
                <code>
                  {decoded.module}::{decoded.name}
                </code>{' '}
                <span className="muted">({decoded.code})</span>
                {decoded.function && (
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    aborted in <code>{decoded.module}::{decoded.function}</code>
                  </span>
                )}
              </span>
              <p className="abort-hint">{decoded.hint}</p>
              <details>
                <summary
                  style={{ cursor: 'pointer', fontSize: 12, color: 'var(--ink-soft)' }}
                >
                  raw error
                </summary>
                <pre style={{ marginTop: 6 }}>{err}</pre>
              </details>
            </div>
          );
        })()}

        {result && (
          <div className="col">
            <Tag tone="live">submitted</Tag>
            <CodeBlock
              code={`sender: ${result.address}\ndigest: ${result.digest}`}
            />
            <a
              href={`https://suiscan.xyz/mainnet/tx/${result.digest}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13 }}
            >
              View on Suiscan ({shortAddr(result.digest)})
            </a>
          </div>
        )}
      </div>
    </details>
  );
}
