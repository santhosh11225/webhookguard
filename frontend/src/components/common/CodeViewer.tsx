import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeViewerProps {
  code: string | object;
  language?: string;
  title?: string;
  maxHeight?: string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language = 'json',
  title,
  maxHeight = 'max-h-72',
}) => {
  const [copied, setCopied] = useState(false);

  const formattedCode =
    typeof code === 'object' ? JSON.stringify(code, null, 2) : String(code);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-dark-700/80 bg-dark-950 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-800 bg-dark-900/90 text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 inline-block" />
          {title && <span className="ml-2 font-medium text-slate-300">{title}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="uppercase text-[10px] tracking-wider text-slate-500 font-semibold">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-dark-800 px-2 py-0.5 rounded transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className={`p-4 overflow-x-auto text-slate-200 leading-relaxed ${maxHeight} selection:bg-brand-600/40`}>
        <code>{formattedCode}</code>
      </pre>
    </div>
  );
};
