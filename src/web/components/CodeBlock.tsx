import { useState } from 'react';

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1100);
    } catch {
      /* clipboard may be unavailable in iframes */
    }
  };
  return (
    <div className="code-block" data-lang={lang}>
      <button className="copy" onClick={onCopy}>
        {copied ? 'copied' : 'copy'}
      </button>
      {code}
    </div>
  );
}
