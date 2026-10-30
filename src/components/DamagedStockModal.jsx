import { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase-config';
import {
  X,
  PackageX,
  Search,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';

export default function DamagedStockModal({
  showDamagedModal,
  setShowDamagedModal,
  inventory = [],
  product = null,
  setProduct,
  onSuccess,
  confirm,
  alert,
}) {
  // Cart state: array of { id, name, brand, type, buyPrice, stock, quantity, reason }
  const [damagedCart, setDamagedCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // When opened with a single product pre-selected, populate the cart
  useEffect(() => {
    if (showDamagedModal) {
      if (product) {
        setDamagedCart([
          {
            id: product.id,
            name: product.name,
            brand: product.brand || '',
            type: product.type || '',
            buyPrice: Number(product.buyPrice) || 0,
            stock: Number(product.stock) || 0,
            quantity: 1,
            reason: 'Broken / Cracked',
          },
        ]);
      } else {
        setDamagedCart([]);
      }
      setSearchTerm('');
      setShowSugg(false);
    }
  }, [showDamagedModal, product]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSugg(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!showDamagedModal) return null;

  // Filter products for search
  const filteredProducts = inventory.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return false;
    const words = q.split(' ').filter(Boolean);
    const txt = `${p.name} ${p.brand || ''} ${p.type || ''}`.toLowerCase();
    return words.every((w) => txt.includes(w));
  });

  // Keyboard navigation for search dropdown
  const handleKeyDown = (e) => {
    if (!showSugg || filteredProducts.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 >= filteredProducts.length ? 0 : prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 < 0 ? filteredProducts.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
        addToDamagedCart(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSugg(false);
      setHighlightedIndex(-1);
    }
  };

  const addToDamagedCart = async (p) => {
    if (p.stock <= 0) {
      await alert('This product is out of stock in inventory.');
      return;
    }
    const existing = damagedCart.find((item) => item.id === p.id);
    if (existing) {
      if (existing.quantity >= p.stock) {
        await alert(`Cannot add more than ${p.stock} units (current stock limit).`);
        return;
      }
      setDamagedCart(
        damagedCart.map((item) =>
          item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setDamagedCart([
        ...damagedCart,
        {
          id: p.id,
          name: p.name,
          brand: p.brand || '',
          type: p.type || '',
          buyPrice: Number(p.buyPrice) || 0,
          stock: Number(p.stock) || 0,
          quantity: 1,
          reason: 'Broken / Cracked',
        },
      ]);
    }
    setSearchTerm('');
    setShowSugg(false);
    setHighlightedIndex(-1);
    searchInputRef.current?.focus();
  };

  const updateQuantity = async (id, val) => {
    const item = damagedCart.find((i) => i.id === id);
    if (!item) return;
    if (val === '') {
      setDamagedCart(damagedCart.map((i) => (i.id === id ? { ...i, quantity: '' } : i)));
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    if (num > item.stock) {
      await alert(`Cannot mark ${num} damaged. Only ${item.stock} in stock.`);
      return;
    }
    if (num <= 0) {
      setDamagedCart(damagedCart.filter((i) => i.id !== id));
    } else {
      setDamagedCart(damagedCart.map((i) => (i.id === id ? { ...i, quantity: num } : i)));
    }
  };

  const handleQtyBlur = (id) => {
    setDamagedCart((prev) =>
      prev.map((i) => {
        if (i.id === id && (!i.quantity || i.quantity <= 0)) {
          return { ...i, quantity: 1 };
        }
        return i;
      })
    );
  };

  const updateReason = (id, reason) => {
    setDamagedCart(damagedCart.map((i) => (i.id === id ? { ...i, reason } : i)));
  };

  const removeFromCart = (id) => {
    setDamagedCart(damagedCart.filter((i) => i.id !== id));
  };

  const totalDamagedUnits = damagedCart.reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const totalLoss = damagedCart.reduce(
    (s, i) => s + (parseInt(i.quantity, 10) || 0) * (i.buyPrice || 0),
    0
  );

  const resetAndClose = () => {
    setShowDamagedModal(false);
    if (setProduct) setProduct(null);
    setDamagedCart([]);
    setSearchTerm('');
    setShowSugg(false);
    setIsSubmitting(false);
  };

  const handleConfirmAll = async () => {
    if (damagedCart.length === 0) {
      await alert('Please add at least one product to the damaged cart.');
      return;
    }

    const invalid = damagedCart.find((i) => !i.quantity || i.quantity <= 0 || i.quantity > i.stock);
    if (invalid) {
      await alert(`Invalid quantity for "${invalid.name}". Please check the quantities.`);
      return;
    }

    const summaryList = damagedCart
      .map(
        (i) =>
          `• ${i.name} (${i.brand || '—'}) × ${i.quantity} pcs @ Rs.${i.buyPrice} = Rs.${(
            i.quantity * i.buyPrice
          ).toLocaleString()} [${i.reason}]`
      )
      .join('\n');

    const isConfirmed = await confirm(
      `Mark ${totalDamagedUnits} item(s) as damaged?\n\n` +
      `${summaryList}\n\n` +
      `Total Financial Loss: Rs.${totalLoss.toLocaleString()}\n\n` +
      `This will reduce stock and deduct buy price value directly from your inventory.`
    );

    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const insertedRecords = [];

      for (const item of damagedCart) {
        const qty = parseInt(item.quantity, 10);
        const itemLoss = qty * item.buyPrice;
        const newStock = Math.max(0, item.stock - qty);

        // 1. Reduce inventory stock
        const { error: invErr } = await supabase
          .from('inventory')
          .update({
            stock: newStock,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (invErr) throw invErr;

        // 2. Insert into damaged_stock table
        const record = {
          product_id: item.id,
          product_name: item.name,
          brand: item.brand || '',
          type: item.type || '',
          quantity: qty,
          buy_price: item.buyPrice,
          total_loss: itemLoss,
          reason: item.reason || 'Broken / Cracked',
          created_at: new Date().toISOString(),
        };

        const { data: insertedData, error: dmgErr } = await supabase
          .from('damaged_stock')
          .insert(record)
          .select()
          .single();

        if (dmgErr) {
          if (dmgErr.code === 'PGRST205' || dmgErr.message?.includes('does not exist')) {
            console.warn('damaged_stock table missing in Supabase');
          } else {
            throw dmgErr;
          }
        }

        insertedRecords.push(insertedData || record);
      }

      if (onSuccess) {
        onSuccess({
          records: insertedRecords,
        });
      }

      await alert(
        `✓ ${totalDamagedUnits} piece(s) recorded as damaged.\n` +
        `Inventory value reduced by Rs.${totalLoss.toLocaleString()} at buy price.`
      );

      resetAndClose();
    } catch (err) {
      console.error('Failed to record damaged items:', err);
      await alert('Error recording damaged items: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up border border-rose-100 overflow-hidden">
        {/* Header - Compact */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-rose-100 bg-gradient-to-r from-rose-50/80 to-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <PackageX size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">
                Record Damaged Stock
              </h2>

            </div>
          </div>
          <button
            className="w-7 h-7 rounded-md bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-all"
            onClick={resetAndClose}
            disabled={isSubmitting}
          >
            <X size={15} />
          </button>
        </div>

        {/* Search Bar - Compact with light label */}
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 shrink-0">
          <label className="block text-[11px] font-normal text-slate-400 mb-1">
            Search product to add into damaged cart
          </label>
          <div className="relative" ref={searchRef}>
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product by name, brand, or type..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSugg(e.target.value.trim().length > 0);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                if (searchTerm.trim().length > 0) setShowSugg(true);
              }}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                onClick={() => {
                  setSearchTerm('');
                  setShowSugg(false);
                }}
              >
                <X size={13} />
              </button>
            )}

            {/* Suggestions Dropdown */}
            {showSugg && filteredProducts.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-rose-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100"
              >
                {filteredProducts.slice(0, 10).map((p, idx) => (
                  <div
                    key={p.id}
                    onClick={() => addToDamagedCart(p)}
                    className={`px-3.5 py-2 cursor-pointer flex items-center justify-between text-xs transition-colors ${highlightedIndex === idx ? 'bg-rose-50' : 'hover:bg-slate-50'
                      }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.brand || '—'} · <span className="text-cyan-700">{p.type}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-amber-600">
                        Rs.{p.buyPrice?.toLocaleString()} buy
                      </div>
                      <div
                        className={`text-[10px] font-semibold ${p.stock <= 0 ? 'text-red-500' : 'text-slate-500'
                          }`}
                      >
                        Stock: {p.stock}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Items Area - Compact table/list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {damagedCart.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ShoppingBag size={36} className="mx-auto mb-2 opacity-30 text-rose-500" />
              <p className="text-xs font-medium text-slate-500">Damaged cart is empty</p>
              <p className="text-[11px] font-normal text-slate-400 mt-0.5">
                Search a product above to add damaged pieces to the cart
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-[11px] font-normal text-slate-400">
                <span>Items in Damaged Cart ({damagedCart.length})</span>
                <span>Reduced at Buy Price</span>
              </div>

              {damagedCart.map((item) => {
                const qty = parseInt(item.quantity, 10) || 0;
                const lineLoss = qty * item.buyPrice;

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-white border border-rose-100 rounded-xl hover:border-rose-200 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    {/* Item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {item.name}
                        </span>
                        {item.brand && (
                          <span className="text-[11px] font-normal text-slate-400">
                            ({item.brand})
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                          {item.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-normal text-slate-400">
                        <span>
                          Buy: <strong className="text-amber-600 font-mono">Rs.{item.buyPrice}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Available: <strong className="text-slate-700 font-mono">{item.stock}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-rose-600 font-bold font-mono">
                          Loss: Rs.{lineLoss.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Controls: Reason + Qty Counter + Delete */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Reason selector */}
                      <select
                        value={item.reason}
                        onChange={(e) => updateReason(item.id, e.target.value)}
                        className="text-xs py-1 px-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none focus:border-rose-400"
                      >
                        <option value="Broken / Cracked">Broken / Cracked</option>
                        <option value="Defective Unit">Defective Unit</option>
                        <option value="Dead on Arrival">Dead on Arrival</option>
                        <option value="Water Damage">Water Damage</option>
                        <option value="Faulty Screen">Faulty Screen</option>
                        <option value="Customer Return">Customer Return</option>
                      </select>

                      {/* Quantity stepper */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-xs active:bg-slate-200"
                          onClick={() => updateQuantity(item.id, (parseInt(item.quantity, 10) || 1) - 1)}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, e.target.value)}
                          onBlur={() => handleQtyBlur(item.id)}
                          className="w-11 text-center py-1 text-xs font-bold font-mono text-slate-800 outline-none"
                        />
                        <button
                          type="button"
                          className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-xs active:bg-slate-200"
                          onClick={() => updateQuantity(item.id, (parseInt(item.quantity, 10) || 0) + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Remove item */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove from damaged cart"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / Summary - Compact */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="font-normal text-slate-400 text-[11px] block">Damaged Units</span>
              <span className="font-bold font-mono text-slate-800 text-sm">
                {totalDamagedUnits} {totalDamagedUnits === 1 ? 'pc' : 'pcs'}
              </span>
            </div>
            <div className="h-7 w-px bg-slate-200" />
            <div>
              <span className="font-normal text-slate-400 text-[11px] block">Total Inventory Loss</span>
              <span className="font-bold font-mono text-rose-600 text-base">
                Rs.{totalLoss.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAndClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || damagedCart.length === 0}
              onClick={handleConfirmAll}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-sm hover:from-rose-700 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <PackageX size={14} />
              <span>{isSubmitting ? 'Recording...' : 'Confirm Damaged'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
