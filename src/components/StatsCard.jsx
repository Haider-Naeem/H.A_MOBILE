import { Eye, EyeOff } from 'lucide-react';

export default function StatsCard({
  title,
  value,
  blurred,
  onToggleBlur,
  isCurrency = false,
  icon: Icon,
  color = 'blue',
  subtitle,
  onClick,
}) {
  const gradients = {
    blue:   'from-cyan-700 to-cyan-500',
    teal:   'from-teal-700 to-teal-500',
    green:  'from-emerald-700 to-emerald-500',
    amber:  'from-amber-600 to-amber-400',
    red:    'from-rose-700 to-rose-500',
    purple: 'from-purple-700 to-purple-500',
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (onToggleBlur) {
      onToggleBlur(e);
    }
  };

  // Format value into string
  const formattedVal = typeof value === 'number'
    ? Math.round(value).toLocaleString()
    : String(value ?? 0);

  // Dynamic responsive font size based on character count so it never overflows on mobile
  const getFontSizeClass = () => {
    const len = formattedVal.length;
    if (len >= 12) return 'text-sm xs:text-base sm:text-xl lg:text-2xl'; // e.g. 100,000,000
    if (len >= 9)  return 'text-base xs:text-lg sm:text-2xl lg:text-3xl'; // e.g. 1,161,960 (user's case)
    if (len >= 7)  return 'text-lg xs:text-xl sm:text-2xl lg:text-3xl';  // e.g. 150,000
    return 'text-xl xs:text-2xl sm:text-3xl';                            // e.g. 415 or 0
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 cursor-pointer transition-all duration-200 shadow-md hover:-translate-y-0.5 hover:shadow-lg bg-gradient-to-br ${gradients[color] || gradients.blue}`}
      onClick={handleClick}
      title={onClick ? 'Click to view details' : onToggleBlur ? (blurred ? 'Click to show' : 'Click to hide') : undefined}
    >
      {/* Decorative background shapes */}
      <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -left-2.5 -bottom-2.5 w-14 h-14 rounded-full bg-white/[0.08] pointer-events-none" />

      {/* Header Row: Title & Actions */}
      <div className="relative z-10 flex justify-between items-center mb-1 gap-1">
        <span className="text-[10px] sm:text-xs font-semibold text-white/85 uppercase tracking-wide leading-tight truncate">
          {title}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {Icon && <Icon size={14} className="text-white/65 shrink-0" />}
          {onToggleBlur && (
            <button
              className="text-white/70 hover:text-white transition-colors p-0.5 shrink-0"
              onClick={e => { e.stopPropagation(); onToggleBlur(); }}
              title={blurred ? 'Show value' : 'Hide value'}
            >
              {blurred ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Value Display — with smaller currency prefix and adaptive font size */}
      <div className={`relative z-10 flex items-baseline gap-0.5 text-white font-mono tracking-tight leading-tight transition-all min-w-0 ${blurred ? 'blur-md select-none' : ''}`}>
        {isCurrency && (
          <span className="text-[11px] sm:text-xs font-medium text-white/80 shrink-0 select-none mr-0.5">
            Rs.
          </span>
        )}
        <span className={`${getFontSizeClass()} font-bold truncate max-w-full`}>
          {formattedVal}
        </span>
      </div>

      {/* Subtitle / click hint */}
      {subtitle ? (
        <div className="relative z-10 text-[10px] sm:text-[11px] font-normal text-white/80 mt-1 truncate">
          {subtitle}
        </div>
      ) : onToggleBlur ? (
        <div className="relative z-10 text-[9px] sm:text-[10px] text-white/60 mt-1 truncate">
          Click to {blurred ? 'show' : 'hide'}
        </div>
      ) : null}
    </div>
  );
}
