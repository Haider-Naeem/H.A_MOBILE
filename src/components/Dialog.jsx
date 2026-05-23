import { useEffect } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

export default function Dialog({ type = 'alert', message, onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); type === 'confirm' ? onConfirm() : onCancel(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [type, onConfirm, onCancel]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[3000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              type === 'confirm' ? 'bg-red-100' : 'bg-cyan-100'
            }`}>
              {type === 'confirm'
                ? <HelpCircle size={24} className="text-red-500" />
                : <AlertCircle size={24} className="text-cyan-600" />
              }
            </div>
            <p className="text-slate-800 font-semibold text-base leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          <div className="flex gap-2.5 mt-6">
            {type === 'confirm' ? (
              <>
                <button
                  autoFocus
                  onClick={onConfirm}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-br from-red-600 to-red-500
                    text-white font-semibold text-sm shadow hover:-translate-y-px transition-all"
                >
                  Confirm
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600
                    border border-slate-300 font-semibold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                autoFocus
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500
                  text-white font-semibold text-sm shadow hover:-translate-y-px transition-all"
              >
                OK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}