import { supabase } from '../supabase-config';
import { X, Plus, Package } from 'lucide-react';

export default function AddStockModal({ showAddStockModal, setShowAddStockModal, stockProduct, setStockProduct, stockAmount, setStockAmount }) {
  const handleAddStock = async () => {
    const amount = parseInt(stockAmount);
    if (!amount || amount <= 0) return alert('Enter a valid quantity (> 0)');
    if (amount > 10000) return alert('Quantity seems too large. Please verify.');

    try {
      const { error } = await supabase
        .from('inventory')
        .update({ stock: stockProduct.stock + amount, updated_at: new Date().toISOString() })
        .eq('id', stockProduct.id);
      if (error) throw error;
      resetAndClose();
    } catch (err) {
      console.error(err);
      alert('Failed to add stock: ' + err.message);
    }
  };

  const resetAndClose = () => {
    setShowAddStockModal(false);
    setStockProduct(null);
    setStockAmount('');
  };

  if (!showAddStockModal || !stockProduct) return null;

  const newStock = stockAmount > 0 ? stockProduct.stock + parseInt(stockAmount) : stockProduct.stock;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto animate-slide-up">

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-sky-50">
          <div className="flex items-center gap-2 text-xl font-bold text-emerald-600">
            <Plus size={20} /> Add Stock
          </div>
          <button
            className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-all"
            onClick={resetAndClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Product Info Card */}
          <div className="bg-cyan-50 border border-cyan-300 rounded-lg p-3.5 mb-5">
            <div className="flex gap-2 items-start">
              <Package size={22} className="text-cyan-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-slate-500 mb-0.5">Product</div>
                <div className="font-bold text-base">{stockProduct.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{stockProduct.brand}</div>
                <span className="mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
                  {stockProduct.type}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-cyan-200">
              <div>
                <div className="text-[10px] text-slate-500">Current Stock</div>
                <div className="text-2xl font-bold text-amber-500 font-mono">{stockProduct.stock}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Buy Price</div>
                <div className="text-base font-bold font-mono">₨{stockProduct.buyPrice}</div>
              </div>
            </div>
          </div>

          {/* Qty Input */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
              Quantity to Add <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              autoFocus
              placeholder="Enter quantity"
              value={stockAmount}
              onChange={e => setStockAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddStock()}
              className="w-full text-center text-2xl font-bold p-3 border-2 border-slate-300 rounded-lg font-mono outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
            />
          </div>

          {/* Preview */}
          {stockAmount > 0 && (
            <div className="flex justify-between items-center bg-emerald-50 border border-emerald-500 rounded-lg px-3.5 py-3 mb-4">
              <div>
                <span className="text-emerald-600 font-semibold">New Stock:</span>
                <div className="text-2xl font-bold text-emerald-600 font-mono">{newStock}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Investment: ₨{(parseInt(stockAmount) * stockProduct.buyPrice).toFixed(0)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            className="flex-1 py-3 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-400 text-white font-semibold text-base shadow-md hover:-translate-y-px transition-all"
            onClick={handleAddStock}
          >
            ✓ Add Stock
          </button>
          <button
            className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold text-base hover:bg-slate-200 transition-all"
            onClick={resetAndClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}