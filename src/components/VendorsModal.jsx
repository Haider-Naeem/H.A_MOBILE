import { useState } from 'react';
import {
  Users, Search, X, Star, Edit3, Check, Trash2, Phone, MapPin, Building2,
} from 'lucide-react';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white ' +
  'outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all';

// ── VendorsModal ─────────────────────────────────────────────────────────────
// Props:
//   show            boolean
//   onClose         () => void
//   onSelectVendor  (vendor) => void        — "Use Vendor" clicked
//   savedVendors    Vendor[]                — owned by parent (OrderTab)
//   loadingVendors  boolean
//   onDeleteVendor  (vendorItem) => void
//   onUpdateVendor  (vendorItem, { name, phone, address }) => Promise<void>
export default function VendorsModal({
  show,
  onClose,
  onSelectVendor,
  savedVendors,
  loadingVendors,
  onDeleteVendor,
  onUpdateVendor,
}) {
  const [search, setSearch]           = useState('');
  const [editingId, setEditingId]     = useState(null);  // vendor id/name being edited
  const [editName, setEditName]       = useState('');
  const [editPhone, setEditPhone]     = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [saving, setSaving]           = useState(false);

  const startEdit = (v) => {
    setEditingId(v.id || v.name);
    setEditName(v.name);
    setEditPhone(v.phone || '');
    setEditAddress(v.address || '');
  };

  const cancelEdit = () => { setEditingId(null); };

  const handleSaveEdit = async (v) => {
    if (!editName.trim()) return alert('Vendor name is required');
    setSaving(true);
    await onUpdateVendor(v, {
      name:    editName.trim(),
      phone:   editPhone.trim(),
      address: editAddress.trim(),
    });
    setSaving(false);
    setEditingId(null);
  };

  const filtered = savedVendors.filter(
    (v) =>
      !search ||
      v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.phone?.includes(search),
  );

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center z-[1000] sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5 text-xl font-bold text-violet-700">
            <Users size={22} /> Saved Vendors
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
              {savedVendors.length}
            </span>
          </div>
          <button
            className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
            <input
              className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Info note ── */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="text-xs text-slate-500 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
            ✨ Vendors are auto-saved when you create an order. You can also edit or remove them here.
          </div>
        </div>

        {/* ── Vendor list ── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5">
          {loadingVendors ? (
            <div className="text-center py-10 text-slate-400">
              <span className="w-6 h-6 border-2 border-violet-400/40 border-t-violet-500 rounded-full animate-spin inline-block mb-2" />
              <p className="text-sm">Loading vendors…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users size={44} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-sm">
                {savedVendors.length === 0 ? 'No vendors saved yet' : 'No vendors match search'}
              </p>
              <p className="text-xs mt-1">Vendors are saved automatically when you create orders</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((v, i) => {
                const vid      = v.id || v.name;
                const isEditing = editingId === vid;

                return (
                  <div
                    key={vid || i}
                    className={`p-4 rounded-xl border transition-all ${
                      isEditing
                        ? 'bg-violet-50 border-violet-300'
                        : 'bg-slate-50 hover:bg-violet-50 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {/* ── Edit form ── */}
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-1">
                          Editing vendor
                        </p>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                              className={inputCls + ' pl-8'}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Vendor name"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Phone</label>
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                              className={inputCls + ' pl-8'}
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="0300-1234567"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Address</label>
                          <div className="relative">
                            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                              className={inputCls + ' pl-8'}
                              value={editAddress}
                              onChange={(e) => setEditAddress(e.target.value)}
                              placeholder="Optional address"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-br from-violet-600 to-violet-500 text-white text-sm font-semibold shadow hover:-translate-y-px transition-all disabled:opacity-50"
                            onClick={() => handleSaveEdit(v)}
                            disabled={saving}
                          >
                            {saving ? (
                              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            Save
                          </button>
                          <button
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 text-sm font-semibold hover:bg-slate-200 transition-all"
                            onClick={cancelEdit}
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Display row ── */
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Star size={13} className="text-violet-400 flex-shrink-0" />
                            <span className="font-bold text-base text-slate-800 truncate">{v.name}</span>
                          </div>
                          {v.phone   && <div className="text-sm text-slate-500">📞 {v.phone}</div>}
                          {v.address && <div className="text-sm text-slate-500 mt-0.5">📍 {v.address}</div>}
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white text-xs font-semibold shadow hover:-translate-y-px transition-all whitespace-nowrap"
                            onClick={() => { onSelectVendor(v); onClose(); }}
                          >
                            Use Vendor
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 border border-violet-200 text-xs font-semibold hover:bg-violet-200 transition-all whitespace-nowrap flex items-center justify-center gap-1"
                            onClick={() => startEdit(v)}
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-red-500 border border-red-200 text-xs font-semibold hover:bg-red-50 transition-all whitespace-nowrap flex items-center justify-center gap-1"
                            onClick={() => onDeleteVendor(v)}
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}