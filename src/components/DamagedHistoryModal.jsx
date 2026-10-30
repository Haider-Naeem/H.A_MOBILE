import { useState } from 'react';
import { supabase } from '../supabase-config';
import { X, PackageX, RotateCcw, Search, ShieldAlert, Calendar } from 'lucide-react';

export default function DamagedHistoryModal({
  showModal,
  setShowModal,
  damagedStock = [],
  inventory = [],
  onRestoreSuccess,
  confirm,
  alert,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [restoringId, setRestoringId] = useState(null);

  if (!showModal) return null;

  const filtered = damagedStock.filter((d) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      (d.product_name || d.productName || '').toLowerCase().includes(q) ||
      (d.brand || '').toLowerCase().includes(q) ||
      (d.type || '').toLowerCase().includes(q) ||
      (d.reason || '').toLowerCase().includes(q)
    );
  });

  const totalUnits = damagedStock.reduce((s, d) => s + (Number(d.quantity) || 0), 0);
  const totalLoss = damagedStock.reduce(
    (s, d) => s + (Number(d.total_loss) || (Number(d.buy_price) * Number(d.quantity)) || 0),
    0
  );

  const handleRestore = async (record) => {
    const qty = Number(record.quantity) || 0;
    const prodName = record.product_name || record.productName || 'Product';
    const prodId = record.product_id || record.productId;

    const ok = await confirm(
      `Restore ${qty} unit(s) of "${prodName}" back to active inventory?\n\n` +
        `• Active stock will increase by +${qty}\n` +
        `• Loss of Rs.${(Number(record.total_loss) || 0).toLocaleString()} will be removed from damaged records.`
    );
    if (!ok) return;

    setRestoringId(record.id);
    try {
      if (prodId) {
        const { data: currentProd, error: fetchErr } = await supabase
          .from('inventory')
          .select('stock')
          .eq('id', prodId)
          .maybeSingle();

        if (!fetchErr && currentProd) {
          const newStock = (Number(currentProd.stock) || 0) + qty;
          const { error: updateErr } = await supabase
            .from('inventory')
            .update({
              stock: newStock,
              updated_at: new Date().toISOString(),
            })
            .eq('id', prodId);

          if (updateErr) throw updateErr;
        }
      }

      const { error: delErr } = await supabase
        .from('damaged_stock')
        .delete()
        .eq('id', record.id);

      if (delErr) throw delErr;

      if (onRestoreSuccess) {
        onRestoreSuccess({
          recordId: record.id,
          productId: prodId,
          restoredQty: qty,
        });
      }

      await alert(`✓ Successfully restored ${qty} unit(s) of "${prodName}" to inventory.`);
    } catch (err) {
      console.error('Failed to restore damaged stock:', err);
      await alert('Failed to restore: ' + err.message);
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col animate-slide-up border border-rose-100 overflow-hidden">
        {/* Header - Compact */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-rose-100 bg-gradient-to-r from-rose-50/80 to-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <PackageX size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">Damaged Stock History</h2>
              <p className="text-[11px] font-normal text-slate-400">
                Log of items reduced from inventory at buy price
              </p>
            </div>
          </div>
          <button
            className="w-7 h-7 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-all"
            onClick={() => setShowModal(false)}
          >
            <X size={15} />
          </button>
        </div>

        {/* Summary Bar - Compact with light labels */}
        <div className="px-5 py-2.5 bg-rose-50/40 border-b border-rose-100 grid grid-cols-3 gap-2 shrink-0">
          <div>
            <span className="text-[10px] font-normal text-slate-400 block">Total Records</span>
            <p className="text-sm font-bold text-slate-700 font-mono">{damagedStock.length}</p>
          </div>
          <div>
            <span className="text-[10px] font-normal text-slate-400 block">Damaged Units</span>
            <p className="text-sm font-bold text-rose-600 font-mono">{totalUnits} units</p>
          </div>
          <div>
            <span className="text-[10px] font-normal text-slate-400 block">Recorded Buy Loss</span>
            <p className="text-sm font-bold text-rose-600 font-mono">Rs.{totalLoss.toLocaleString()}</p>
          </div>
        </div>

        {/* Search - Compact with light label */}
        <div className="px-5 py-2 bg-slate-50/60 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by product name, brand or defect reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200"
            />
          </div>
        </div>

        {/* List - Compact */}
        <div className="overflow-y-auto flex-1 p-3.5 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ShieldAlert size={36} className="mx-auto mb-1.5 opacity-30 text-rose-500" />
              <p className="text-xs font-medium text-slate-500">No damaged stock records found</p>
              <p className="text-[11px] font-normal text-slate-400 mt-0.5">
                {searchTerm ? 'Try adjusting your search query' : 'No items have been marked as damaged yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((record) => {
                const loss =
                  Number(record.total_loss) ||
                  (Number(record.buy_price) * Number(record.quantity)) ||
                  0;
                const isRestoring = restoringId === record.id;

                return (
                  <div
                    key={record.id}
                    className="p-2.5 bg-white border border-rose-100 rounded-xl hover:border-rose-200 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {record.product_name || record.productName}
                        </span>
                        {record.brand && (
                          <span className="text-[11px] font-normal text-slate-400">
                            ({record.brand})
                          </span>
                        )}
                        {record.type && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700">
                            {record.type}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-normal text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-slate-400" />
                          {formatDate(record.created_at)}
                        </span>
                        <span>•</span>
                        <span className="text-rose-600 font-medium">
                          {record.reason || 'Damaged / Defective'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-[11px] font-normal text-slate-500">
                          {record.quantity} {record.quantity === 1 ? 'unit' : 'units'} × Rs.
                          {(Number(record.buy_price) || 0).toLocaleString()}
                        </div>
                        <div className="text-xs font-bold font-mono text-rose-600">
                          -Rs.{loss.toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRestore(record)}
                        disabled={isRestoring}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-all disabled:opacity-50 whitespace-nowrap active:scale-95"
                        title="Restore back to active inventory"
                      >
                        <RotateCcw size={12} className={isRestoring ? 'animate-spin' : ''} />
                        <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Compact */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-300 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
