import { useState } from 'react';
import { ShoppingCart, Package, TrendingUp, ClipboardList, Lock, Key, Menu, X } from 'lucide-react';

export default function Header({ activeTab, requestTab, isAdmin, onChangePin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'pos',       label: 'POS',       icon: ShoppingCart, public: true  },
    { id: 'inventory', label: 'Inventory', icon: Package,       public: false },
    { id: 'sales',     label: 'Sales',     icon: TrendingUp,    public: false },
    { id: 'orders',    label: 'Orders',    icon: ClipboardList, public: false },
  ];

  const handleTabClick = (tabId) => {
    requestTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="bg-gradient-to-r from-cyan-800 via-cyan-600 to-cyan-500 sticky top-0 z-[100] shadow-lg shadow-cyan-900/35">
      <div className="max-w-[1280px] mx-auto px-6 flex justify-between items-center h-16 relative">
        {/* Brand */}
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight leading-tight md:text-[22px]">H.A MOBILE</h1>
          <p className="text-[11px] text-white/70 font-normal tracking-wide hidden sm:block">Software & Repairing</p>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2">
          {isAdmin && (
            <button
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/15 text-white/90 border border-white/20 hover:bg-white/25 hover:text-white transition-all"
              onClick={onChangePin}
              title="Change PIN"
            >
              <Key size={14} />
              <span>Change PIN</span>
            </button>
          )}

          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                activeTab === tab.id
                  ? 'bg-white text-cyan-700 border-transparent shadow-md'
                  : 'text-white/80 bg-white/10 border-white/15 hover:bg-white/20 hover:text-white'
              }`}
              onClick={() => requestTab(tab.id)}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
              {!tab.public && !isAdmin && (
                <Lock size={12} className="text-amber-400" />
              )}
            </button>
          ))}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden flex items-center justify-center bg-white/15 text-white border border-white/20 rounded-lg px-3 py-2 hover:bg-white/25 transition-all"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-gradient-to-r from-cyan-800 via-cyan-600 to-cyan-500 px-5 pb-5 pt-3 shadow-2xl shadow-cyan-900/40 z-[99] animate-slide-down">
          {isAdmin && (
            <button
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-lg text-base font-semibold text-white/90 bg-white/10 border border-white/15 mb-2 hover:bg-white hover:text-cyan-700 hover:border-transparent transition-all"
              onClick={() => { onChangePin(); setMobileMenuOpen(false); }}
            >
              <Key size={18} />
              <span>Change PIN</span>
            </button>
          )}
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-lg text-base font-semibold mb-2 last:mb-0 border transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-cyan-700 border-transparent'
                  : 'text-white/90 bg-white/10 border-white/15 hover:bg-white hover:text-cyan-700 hover:border-transparent'
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
              {!tab.public && !isAdmin && (
                <Lock size={14} className="text-amber-400 ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}