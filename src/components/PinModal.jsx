import { Lock } from 'lucide-react';

export default function PinModal({ pinInput, setPinInput, onVerify, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-cyan-600" />
          </div>

          <h2 className="text-xl font-bold mb-1.5">Admin Access</h2>
          <p className="text-slate-500 text-sm mb-5">Enter your 4-digit PIN to continue</p>

          <input
            type="password"
            value={pinInput}
            onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && pinInput.length === 4 && onVerify()}
            placeholder="••••"
            maxLength="4"
            autoFocus
            className="w-full text-center text-3xl tracking-[1rem] p-3 border-2 border-cyan-600 rounded-lg font-mono mb-3 outline-none focus:ring-2 focus:ring-cyan-300"
          />

          <div className="flex justify-center gap-2.5 mb-4">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${pinInput.length > i ? 'bg-cyan-600 scale-110' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          <div className="flex gap-2.5">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold text-base shadow-md hover:-translate-y-px transition-all disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed"
              onClick={onVerify}
              disabled={pinInput.length !== 4}
            >
              🔓 Unlock
            </button>
            <button
              className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold text-base hover:bg-slate-200 transition-all"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}