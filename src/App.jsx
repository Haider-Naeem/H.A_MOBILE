import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase-config';
import Header from './components/Header';
import PosTab from './components/PosTab';
import InventoryTab from './components/InventoryTab';
import SalesTab from './components/SalesTab';
import OrderTab from './components/OrderTab';
import AddProductModal from './components/AddProductModal';
import AddStockModal from './components/AddStockModal';
import DamagedStockModal from './components/DamagedStockModal';
import DamagedHistoryModal from './components/DamagedHistoryModal';
import WhatsAppBillModal from './components/WhatsAppBillModal';
import ReturnModal from './components/ReturnModal';
import PinModal from './components/PinModal';
import ChangePinModal from './components/ChangePinModal';
import Dialog from './components/Dialog';
import { useDialog } from './hooks/useDialog';

const DEFAULT_TYPES = [
  'Screen Protector', 'Front Camera', 'Back Camera', 'Battery',
  'Charger', 'Cable', 'Earphones', 'Power Bank', 'Phone Cover'
];

export default function App() {
  // ── Dialog ───────────────────────────────────────────────────
  const { dialog, confirm, alert, handleConfirm, handleCancel } = useDialog();

  // ── Tab / Auth ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('pos');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [requestedTab, setRequestedTab] = useState(null);
  const [adminPin, setAdminPin] = useState('1234');

  // ── Data ─────────────────────────────────────────────────────
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [damagedStock, setDamagedStock] = useState([]);
  const [productTypes, setProductTypes] = useState(DEFAULT_TYPES);

  // ── Modals ───────────────────────────────────────────────────
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showDamagedModal, setShowDamagedModal] = useState(false);
  const [showDamagedHistory, setShowDamagedHistory] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // ── Form / Product ───────────────────────────────────────────
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: '', brand: '', type: 'Screen Protector', customType: '',
    buyPrice: '', retailPrice: '', stock: ''
  });
  const [stockProduct, setStockProduct] = useState(null);
  const [damagedProduct, setDamagedProduct] = useState(null);
  const [stockAmount, setStockAmount] = useState('');

  // ── POS ──────────────────────────────────────────────────────
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);

  // ── Sales / Return Filters ───────────────────────────────────
  const [salesFilter, setSalesFilter] = useState('daily');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [returnSearch, setReturnSearch] = useState('');

  // ── Stats / UI ───────────────────────────────────────────────
  const [blurredCards, setBlurredCards] = useState(new Set());
  const [stats, setStats] = useState({
    inventoryCost: 0, retailValue: 0, totalProfit: 0, totalRevenue: 0
  });

  // ── Map helpers ──────────────────────────────────────────────
  const mapItem = (row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand || '',
    type: row.type,
    buyPrice: Number(row.buy_price) || 0,
    retailPrice: Number(row.retail_price) || 0,
    stock: Number(row.stock) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const mapSale = (row) => ({
    id: row.id,
    customerName: row.customer_name,
    customerMobile: row.customer_mobile,
    cashierName: row.cashier_name,
    receiptNo: row.receipt_no,
    items: row.items || [],
    total: Number(row.total) || 0,
    timestamp: row.timestamp,
    customer_name: row.customer_name,
    customer_mobile: row.customer_mobile,
    cashier_name: row.cashier_name,
    receipt_no: row.receipt_no,
  });

  const mapOrder = (row) => ({
    id: row.id,
    orderNo: row.order_no,
    vendorName: row.vendor_name,
    vendorPhone: row.vendor_phone,
    vendorAddress: row.vendor_address,
    items: row.items || [],
    status: row.status,
    createdAt: row.created_at,
    receivedAt: row.received_at,
    order_no: row.order_no,
    vendor_name: row.vendor_name,
    vendor_phone: row.vendor_phone,
    vendor_address: row.vendor_address,
    created_at: row.created_at,
    received_at: row.received_at,
  });

  // ── Fetchers ─────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory').select('*').order('name');
    if (!error && data) setInventory(data.map(mapItem));
  }, []);

  const fetchSales = useCallback(async () => {
    const { data, error } = await supabase
      .from('sales').select('*').order('timestamp', { ascending: false });
    if (!error && data) setSales(data.map(mapSale));
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders').select('*').order('created_at', { ascending: false });
    if (!error && data) setOrders(data.map(mapOrder));
  }, []);

  const fetchDamagedStock = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('damaged_stock')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setDamagedStock(data);
      } else if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
        setDamagedStock([]);
      }
    } catch (err) {
      console.warn('Damaged stock fetch error:', err);
    }
  }, []);

  const fetchAdminPin = useCallback(async () => {
    const { data } = await supabase
      .from('settings').select('value').eq('id', 'adminPin').maybeSingle();
    if (data?.value) setAdminPin(data.value);
  }, []);

  useEffect(() => {
    fetchInventory(); fetchSales(); fetchOrders(); fetchDamagedStock(); fetchAdminPin();
  }, [fetchInventory, fetchSales, fetchOrders, fetchDamagedStock, fetchAdminPin]);

  // ── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    const invChannel = supabase.channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory)
      .subscribe();
    const salesChannel = supabase.channel('sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchSales)
      .subscribe();
    const ordersChannel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    const damagedChannel = supabase.channel('damaged-stock-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'damaged_stock' }, fetchDamagedStock)
      .subscribe();

    return () => {
      supabase.removeChannel(invChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(damagedChannel);
    };
  }, [fetchInventory, fetchSales, fetchOrders, fetchDamagedStock]);

  // ── Stats ─────────────────────────────────────────────────────
  useEffect(() => {
    const inventoryCost = inventory.reduce((s, p) => s + p.buyPrice * p.stock, 0);
    const retailValue = inventory.reduce((s, p) => s + p.retailPrice * p.stock, 0);
    const totalRevenue = sales.reduce((s, sale) => s + (sale.total || 0), 0);
    const totalProfit = sales.reduce((s, sale) =>
      s + (sale.items || []).reduce((a, i) => {
        const rq = i.returnedQuantity || 0;
        return a + (i.soldAt - i.buyPrice) * (i.quantity - rq);
      }, 0), 0);
    const totalDamagedLoss = (damagedStock || []).reduce((s, d) =>
      s + (Number(d.total_loss) || (Number(d.buy_price) * Number(d.quantity)) || 0), 0);
    setStats({ inventoryCost, retailValue, totalRevenue, totalProfit, totalDamagedLoss });
  }, [inventory, sales, damagedStock]);

  // ── Tab navigation ────────────────────────────────────────────
  const requestTab = (tab) => {
    if (tab === 'pos') {
      setActiveTab('pos'); setIsAdmin(false);
    } else if (isAdmin) {
      setActiveTab(tab);
    } else {
      setRequestedTab(tab); setShowPinModal(true);
    }
  };

  // ✅ No more native alert() — uses custom dialog
  const verifyPin = async () => {
    if (pinInput === adminPin) {
      setIsAdmin(true); setActiveTab(requestedTab);
      setShowPinModal(false); setPinInput(''); setRequestedTab(null);
    } else {
      setShowPinModal(false);
      await alert('Incorrect PIN. Please try again.');
      setShowPinModal(true);
      setPinInput('');
    }
  };

  const handleChangePin = async (oldPin, newPin) => {
    if (oldPin !== adminPin) {
      await alert('Incorrect current PIN.');
      return false;
    }
    try {
      const { error } = await supabase.from('settings')
        .upsert({ id: 'adminPin', value: newPin });
      if (error) throw error;
      setAdminPin(newPin);
      await alert('PIN changed successfully!');
      return true;
    } catch (err) {
      await alert('Failed to change PIN: ' + err.message);
      return false;
    }
  };

  const toggleBlur = (card) => {
    setBlurredCards(prev => {
      const n = new Set(prev);
      n.has(card) ? n.delete(card) : n.add(card);
      return n;
    });
  };

  const handleDamagedSuccess = ({ records, productId, newStock, damagedRecord }) => {
    fetchDamagedStock();
    fetchInventory();
  };

  const handleRestoreSuccess = ({ recordId, productId, restoredQty }) => {
    if (productId) {
      setInventory(prev => prev.map(p => p.id === productId ? { ...p, stock: p.stock + restoredQty } : p));
    }
    setDamagedStock(prev => prev.filter(d => d.id !== recordId));
    fetchDamagedStock();
    fetchInventory();
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f9ff]">
      <Header
        activeTab={activeTab}
        requestTab={requestTab}
        isAdmin={isAdmin}
        onChangePin={() => setShowChangePinModal(true)}
      />

      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-3 sm:py-5">

        {activeTab === 'pos' && (
          <PosTab
            cart={cart} setCart={setCart}
            inventory={inventory}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            customerName={customerName} setCustomerName={setCustomerName}
            customerMobile={customerMobile} setCustomerMobile={setCustomerMobile}
            setLastReceipt={setLastReceipt}
            setShowReceipt={setShowReceipt}
            setShowReturnModal={setShowReturnModal}
            returnSearch={returnSearch} setReturnSearch={setReturnSearch}
            sales={sales}
            confirm={confirm}
            alert={alert}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab
            inventory={inventory}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            setShowAddProductModal={setShowAddProductModal}
            editingProduct={editingProduct} setEditingProduct={setEditingProduct}
            form={form} setForm={setForm}
            productTypes={productTypes} setProductTypes={setProductTypes}
            setShowAddStockModal={setShowAddStockModal}
            stockProduct={stockProduct} setStockProduct={setStockProduct}
            stockAmount={stockAmount} setStockAmount={setStockAmount}
            damagedStock={damagedStock}
            onOpenDamagedModal={(product) => { setDamagedProduct(product); setShowDamagedModal(true); }}
            onOpenDamagedHistory={() => setShowDamagedHistory(true)}
            stats={stats} blurredCards={blurredCards} toggleBlur={toggleBlur}
            confirm={confirm}
            alert={alert}
          />
        )}

        {activeTab === 'sales' && (
          <SalesTab
            sales={sales}
            salesFilter={salesFilter} setSalesFilter={setSalesFilter}
            customStartDate={customStartDate} setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate} setCustomEndDate={setCustomEndDate}
            stats={stats} blurredCards={blurredCards} toggleBlur={toggleBlur}
            onSendBill={(receipt) => { setLastReceipt(receipt); setShowReceipt(true); }}
            confirm={confirm}
            alert={alert}
          />
        )}

        {activeTab === 'orders' && (
          <OrderTab
            inventory={inventory}
            orders={orders}
            confirm={confirm}
            alert={alert}
          />
        )}

      </div>

      {/* ── Modals ── */}
      {showAddProductModal && (
        <AddProductModal
          showAddProductModal={showAddProductModal}
          setShowAddProductModal={setShowAddProductModal}
          editingProduct={editingProduct} setEditingProduct={setEditingProduct}
          form={form} setForm={setForm}
          productTypes={productTypes} setProductTypes={setProductTypes}
          confirm={confirm}
          alert={alert}
        />
      )}
      {showAddStockModal && (
        <AddStockModal
          showAddStockModal={showAddStockModal}
          setShowAddStockModal={setShowAddStockModal}
          stockProduct={stockProduct} setStockProduct={setStockProduct}
          stockAmount={stockAmount} setStockAmount={setStockAmount}
          confirm={confirm}
          alert={alert}
        />
      )}
      {showDamagedModal && (
        <DamagedStockModal
          showDamagedModal={showDamagedModal}
          setShowDamagedModal={setShowDamagedModal}
          inventory={inventory}
          product={damagedProduct}
          setProduct={setDamagedProduct}
          onSuccess={handleDamagedSuccess}
          confirm={confirm}
          alert={alert}
        />
      )}
      {showDamagedHistory && (
        <DamagedHistoryModal
          showModal={showDamagedHistory}
          setShowModal={setShowDamagedHistory}
          damagedStock={damagedStock}
          inventory={inventory}
          onRestoreSuccess={handleRestoreSuccess}
          confirm={confirm}
          alert={alert}
        />
      )}
      {showReceipt && lastReceipt && (
        <WhatsAppBillModal
          receipt={lastReceipt}
          onClose={() => setShowReceipt(false)}
        />
      )}
      {showReturnModal && (
        <ReturnModal
          showReturnModal={showReturnModal}
          setShowReturnModal={setShowReturnModal}
          returnSearch={returnSearch} setReturnSearch={setReturnSearch}
          sales={sales} inventory={inventory}
          confirm={confirm}
          alert={alert}
        />
      )}
      {showPinModal && (
        <PinModal
          pinInput={pinInput} setPinInput={setPinInput}
          onVerify={verifyPin}
          onCancel={() => { setShowPinModal(false); setPinInput(''); setRequestedTab(null); }}
        />
      )}
      {showChangePinModal && (
        <ChangePinModal
          onClose={() => setShowChangePinModal(false)}
          onChangePin={handleChangePin}
        />
      )}

      {/* ── Global Dialog — always on top ── */}
      {dialog && (
        <Dialog
          type={dialog.type}
          message={dialog.message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}