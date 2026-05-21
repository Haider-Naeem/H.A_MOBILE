import { supabase } from '../supabase-config';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AddProductModal({
  showAddProductModal, setShowAddProductModal,
  editingProduct, setEditingProduct,
  form, setForm, productTypes, setProductTypes
}) {
  const [saving, setSaving] = useState(false);

  // Load custom types from Supabase on mount
  useEffect(() => {
    if (showAddProductModal) {
      loadCustomTypes();
    }
  }, [showAddProductModal]);

  const loadCustomTypes = async () => {
    try {
      // Fetch distinct types from inventory
      const { data, error } = await supabase
        .from('inventory')
        .select('type')
        .not('type', 'is', null);
      
      if (error) throw error;
      
      // Get unique types
      const types = [...new Set(data.map(item => item.type))];
      const defaultTypes = ['Screen Protector', 'Phone Case', 'Charger', 'Cable', 'Headphone', 'Other'];
      const allTypes = [...new Set([...defaultTypes, ...types])].sort();
      
      setProductTypes(allTypes);
    } catch (err) {
      console.error('Error loading types:', err);
    }
  };

  const saveCustomType = async (typeName) => {
    try {
      // Save custom type to a separate table or just rely on inventory
      // For now, we'll just ensure it's in the productTypes list
      if (!productTypes.includes(typeName)) {
        const updatedTypes = [...productTypes, typeName].sort();
        setProductTypes(updatedTypes);
        
        // Optional: Save to a custom_types table for persistence
        const { error } = await supabase
          .from('custom_types')
          .insert([{ type_name: typeName }])
          .select();
        
        if (error && error.code !== '23505') { // Ignore duplicate error
          console.error('Error saving custom type:', error);
        }
      }
    } catch (err) {
      console.error('Error saving custom type:', err);
    }
  };

  const handleSave = async () => {
    if (!form.brand.trim())      return alert('Brand name is required');
    if (!form.name.trim())       return alert('Product name is required');
    if (!form.buyPrice || parseFloat(form.buyPrice) <= 0) return alert('Valid buy price required');
    if (!form.retailPrice || parseFloat(form.retailPrice) <= 0) return alert('Valid retail price required');
    if (form.stock === '' || parseInt(form.stock) < 0) return alert('Valid stock quantity required');

    setSaving(true);
    
    let finalType = form.type;
    if (form.type === 'Other') {
      if (!form.customType.trim()) {
        setSaving(false);
        return alert('Please enter a custom type name');
      }
      finalType = form.customType.trim();
      // Save custom type to Supabase
      await saveCustomType(finalType);
    }

    const data = {
      brand:        form.brand.trim(),
      name:         form.name.trim(),
      type:         finalType,
      buy_price:    parseFloat(form.buyPrice),
      retail_price: parseFloat(form.retailPrice),
      stock:        parseInt(form.stock),
      updated_at:   new Date().toISOString()
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('inventory')
          .update(data)
          .eq('id', editingProduct.id);
        if (error) throw error;
        alert('Product updated successfully!');
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert([{ ...data, created_at: new Date().toISOString() }]);
        if (error) throw error;
        alert('Product added successfully!');
      }
      
      // Reload custom types after save
      await loadCustomTypes();
      resetAndClose();
    } catch (err) {
      console.error(err);
      alert('Error saving product: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setForm({ brand: '', name: '', type: 'Screen Protector', customType: '', buyPrice: '', retailPrice: '', stock: '' });
    setEditingProduct(null);
    setShowAddProductModal(false);
  };

  if (!showAddProductModal) return null;

  const profit = form.buyPrice && form.retailPrice
    ? parseFloat(form.retailPrice) - parseFloat(form.buyPrice)
    : null;

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-sky-50">
          <div className="text-xl font-bold text-slate-800">
            {editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}
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
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                autoFocus
                placeholder="e.g., Baseus, Spigen"
                value={form.brand}
                onChange={e => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                placeholder="e.g., iPhone 15 Screen Protector"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
              Product Type <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              {productTypes.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="Other">➕ Other (Custom)</option>
            </select>
          </div>

          {form.type === 'Other' && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
                Custom Type Name <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                placeholder="e.g., Wireless Charger, Phone Stand"
                value={form.customType}
                onChange={e => setForm({ ...form, customType: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
                Buy Price (Rs.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                placeholder="1000"
                value={form.buyPrice}
                onChange={e => setForm({ ...form, buyPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
                Retail Price (Rs.) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
                placeholder="1500"
                value={form.retailPrice}
                onChange={e => setForm({ ...form, retailPrice: e.target.value })}
              />
            </div>
          </div>

          {profit !== null && (
            <div className="mb-4">
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-500 rounded-lg px-3.5 py-2.5">
                <span className="font-semibold text-emerald-600 text-sm">Profit per unit:</span>
                <span className="font-bold text-emerald-600 text-lg">Rs.{profit.toFixed(0)}</span>
              </div>
              {profit < 0 && (
                <div className="mt-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 border-l-4 border-red-500 text-red-600">
                  ⚠️ Retail price is lower than buy price!
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wide">
              Stock Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 transition-all"
              placeholder="50"
              min="0"
              value={form.stock}
              onChange={e => setForm({ ...form, stock: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gradient-to-br from-cyan-700 to-cyan-500 text-white font-semibold shadow-md hover:-translate-y-px transition-all disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              editingProduct ? '💾 Update Product' : '✓ Add Product'
            )}
          </button>
          <button
            className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-300 font-semibold hover:bg-slate-200 transition-all"
            onClick={resetAndClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}