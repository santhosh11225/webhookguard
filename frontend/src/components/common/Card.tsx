import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
  footer,
}) => {
  return (
    <div className={`glass-card rounded-xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-dark-700/60">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="mt-4 pt-3 border-t border-dark-700/60 text-xs text-slate-400">{footer}</div>
      )}
    </div>
  );
};
