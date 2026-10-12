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
    <div className={`bg-white border border-gray-200 rounded-lg p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-200">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-base font-semibold text-[#333333]">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
      {footer && (
        <div className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500">{footer}</div>
      )}
    </div>
  );
};
