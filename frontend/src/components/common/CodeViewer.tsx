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
    <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white text-gray-500">
        <div className="flex items-center gap-2">
          {title && <span className="font-medium text-[#333333]">{title}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="uppercase text-[10px] tracking-wider text-gray-400 font-semibold">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#333333] hover:bg-gray-100 px-2 py-0.5 rounded border border-gray-200 bg-white transition-colors"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                <span className="text-green-600">Copied</span>
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
      <pre className={`p-4 overflow-x-auto text-[#333333] leading-relaxed ${maxHeight}`}>
        <code>{formattedCode}</code>
      </pre>
    </div>
  );
};
