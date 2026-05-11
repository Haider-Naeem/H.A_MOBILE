import { useState, useRef, useEffect } from 'react';
import { Lock, X } from 'lucide-react';

// 4-box PIN input with auto-advance and backspace-step-back
function PinBoxes({ label, value, onChange, inputRefs }) {
  const digits = value.split('');

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[idx]) {
        // clear current box
        const next = value.slice(0, idx) + value.slice(idx + 1);
        onChange(next.padEnd(idx, value)); // just remove this digit
        const updated = [...digits];
        updated[idx] = '';
        onChange(updated.join(''));
      } else if (idx > 0) {
        // step back and clear previous
        const updated = [...digits];
        updated[idx - 1] = '';
        onChange(updated.join(''));
        setTimeout(() => inputRefs.current[idx - 1]?.focus(), 0);
      }
    }
  };

  const handleInput = (e, idx) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    const digit = raw[raw.length - 1]; // take last digit in case of paste
    const updated = [...digits];
    updated[idx] = digit;
    // fill extras from paste
    for (let i = 1; i < raw.length && idx + i < 4; i++) {
      updated[idx + i] = raw[i];
    }
    onChange(updated.join(''));
    const nextIdx = Math.min(idx + raw.length, 3);
    setTimeout(() => inputRefs.current[nextIdx]?.focus(), 0);
  };

  const handleFocus = (e) => e.target.select();

  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex gap-3 justify-center">
        {[0, 1, 2, 3].map(i => (
          <input
            key={i}
            ref={el => (inputRefs.current[i] = el)}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] || ''}
            onChange={e => handleInput(e, i)}
            onKeyDown={e => handleKeyDown(e, i)}
            onFocus={handleFocus}
            className={`
              w-14 h-14 text-center text-2xl font-mono font-bold border-2 rounded-xl
              outline-none transition-all duration-150 bg-white
              ${digits[i]
                ? 'border-cyan-500 bg-cyan-50 text-cyan-700 shadow-[0_0_0_3px_rgba(6,182,212,0.15)]'
                : 'border-slate-300 text-slate-800 focus:border-cyan-500 focus:shadow-[0_0_0_3px_rgba(6,182,212,0.15)]'
              }
            `}
          />
        ))}
      </div>
      {/* dot indicators */}
      <div className="flex justify-center gap-2 mt-2.5">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              digits[i] ? 'bg-cyan-500 scale-110' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChangePinModal({ onClose, onChangePin }) {
  const [oldPin,     setOldPin]     = useState('');
  const [newPin,     setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error,      setError]      = useState('');

  const oldRefs     = useRef([]);
  const newRefs     = useRef([]);
  const confirmRefs = useRef([]);

  // auto-focus first box of old PIN on open
  useEffect(() => {
    setTimeout(() => oldRefs.current[0]?.focus(), 80);
  }, []);

  // auto-advance between fields when a field is complete
  useEffect(() => {
    if (oldPin.length === 4) setTimeout(() => newRefs.current[0]?.focus(), 50);
  }, [oldPin]);

  useEffect(() => {
    if (newPin.length === 4) setTimeout(() => confirmRefs.current[0]?.focus(), 50);
  }, [newPin]);

  const handleSubmit = async () => {
    setError('');
    if (oldPin.length !== 4)        return setError('Current PIN must be 4 digits');
    if (newPin.length !== 4)        return setError('New PIN must be 4 digits');
    if (newPin !== confirmPin)      return setError('New PINs do not match');
    if (oldPin === newPin)          return setError('New PIN must differ from current PIN');
    const ok = await onChangePin(oldPin, newPin);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-sky-50">
          <div className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Lock size={20} className="text-cyan-600" />
            Change PIN
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg text-sm font-medium bg-red-50 border-l-4 border-red-500 text-red-600">
              {error}
            </div>
          )}

          <PinBoxes
            label="Current PIN"
            value={oldPin}
            onChange={setOldPin}
            inputRefs={oldRefs}
          />
          <PinBoxes
            label="New PIN"
            value={newPin}
            onChange={setNewPin}
            inputRefs={newRefs}
          />
          <PinBoxes
            label="Confirm New PIN"
            value={confirmPin}
            onChange={setConfirmPin}
            inputRefs={confirmRefs}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold shadow-md hover:-translate-y-px transition-all disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed"
          >
            Change PIN
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}