import { Eye, EyeOff } from 'lucide-react';

export default function StatsCard({ title, value, blurred, onToggleBlur, isCurrency = false, icon: Icon, color = 'blue' }) {
  const gradients = {
    blue:  'from-cyan-700 to-cyan-500',
    teal:  'from-teal-700 to-teal-500',
    green: 'from-emerald-700 to-emerald-500',
    amber: 'from-amber-600 to-amber-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl px-4 py-3.5 sm:py-4 cursor-pointer transition-all duration-200 shadow-md hover:-translate-y-0.5 hover:shadow-lg bg-gradient-to-br ${gradients[color] || gradients.blue}`}
      onClick={onToggleBlur}
      title={onToggleBlur ? (blurred ? 'Click to show' : 'Click to hide') : undefined}
    >
      {/* Decorative circles */}
      <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -left-2.5 -bottom-2.5 w-14 h-14 rounded-full bg-white/[0.08] pointer-events-none" />

      {/* Title row */}
      <div className="relative z-10 flex justify-between items-center mb-1.5">
        <span className="text-[11px] sm:text-xs font-medium text-white/75 uppercase tracking-wider leading-tight">
          {title}
        </span>
        {onToggleBlur ? (
          <button
            className="text-white/70 hover:text-white transition-colors p-0.5 flex-shrink-0"
            onClick={e => { e.stopPropagation(); onToggleBlur(); }}
          >
            {blurred ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        ) : Icon ? (
          <Icon size={16} className="text-white/50 flex-shrink-0" />
        ) : null}
      </div>

      {/* Value */}
      <div className={`relative z-10 text-2xl sm:text-3xl font-bold text-white font-mono tracking-tight transition-all ${blurred ? 'blur-lg select-none' : ''}`}>
        {isCurrency && 'Rs.'}
        {isCurrency
          ? (typeof value === 'number' ? Math.round(value).toLocaleString() : value)
          : (typeof value === 'number' ? value.toLocaleString() : value)
        }
      </div>

      {onToggleBlur && (
        <div className="relative z-10 text-[10px] text-white/55 mt-1">
          Click to {blurred ? 'show' : 'hide'}
        </div>
      )}
    </div>
  );
}