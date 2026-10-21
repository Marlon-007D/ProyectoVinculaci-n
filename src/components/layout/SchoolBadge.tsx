interface SchoolBadgeProps {
  institutionName?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function SchoolBadge({
  institutionName,
  size = 'md',
  showText = true,
  className = '',
}: SchoolBadgeProps) {
  const sizeMap = {
    sm: { box: 'w-8 h-8 text-xs', textClass: 'text-xs', subClass: 'text-[9px]' },
    md: { box: 'w-10 h-10 text-sm', textClass: 'text-sm font-bold', subClass: 'text-[10px]' },
    lg: { box: 'w-12 h-12 text-base', textClass: 'text-base font-bold', subClass: 'text-xs' },
  };

  const { box, textClass, subClass } = sizeMap[size];
  const displayName = institutionName || 'Portal Institucional';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className={`shrink-0 rounded-lg bg-[#0a233f] text-white font-extrabold flex items-center justify-center border border-slate-700 shadow-xs tracking-wider ${box}`}>
        UE
      </div>

      {showText && (
        <div className="flex flex-col justify-center leading-tight min-w-0">
          <span className={`tracking-tight text-gray-900 truncate max-w-[280px] sm:max-w-[340px] ${textClass}`}>
            {displayName}
          </span>
          <span className={`font-semibold text-slate-500 uppercase tracking-wider ${subClass}`}>
            Plataforma Institucional
          </span>
        </div>
      )}
    </div>
  );
}
