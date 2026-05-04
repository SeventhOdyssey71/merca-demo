/**
 * Render a Sui object ID as a monospaced, clickable Suiscan link.
 * The full address is shown — wraps cleanly via word-break: break-all.
 */
export function ChainId({
  id,
  kind = 'object',
}: {
  id: string;
  kind?: 'object' | 'package' | 'tx';
}) {
  const path = kind === 'tx' ? 'tx' : 'object';
  return (
    <a
      className="chain-id"
      href={`https://suiscan.xyz/mainnet/${path}/${id}`}
      target="_blank"
      rel="noreferrer"
      title={id}
    >
      {id}
    </a>
  );
}
