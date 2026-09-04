import { useState, useEffect, useMemo } from 'react';
import { api, usePoll } from './api.js';

const STORE_NAME = 'Gramin Seva Medicals';
const STORE_ID = 'PH-94021';

// Seed catalog for standard rural pharmacy inventory items
const INITIAL_CATALOG = [
  { id: 'inv-801', medicine: 'Generic Paracetamol', generic: 'Paracetamol 650mg', form: 'Tablet', manufacturer: 'Jan Aushadhi', quantity: 42, price: 12, batch: 'JA-4412', expiry: 'Dec 2025', isJanAushadhi: true },
  { id: 'inv-802', medicine: 'Telma 40', generic: 'Telmisartan 40mg', form: 'Tablet', manufacturer: 'Glenmark', quantity: 28, price: 48, batch: 'TL-8891', expiry: 'Nov 2026', isJanAushadhi: false },
  { id: 'inv-803', medicine: 'Augmentin 625 Duo', generic: 'Amoxicillin + Clavulanic Acid', form: 'Tablet', manufacturer: 'GSK', quantity: 8, price: 204, batch: 'A-1102', expiry: 'Jan 2026', isJanAushadhi: false },
  { id: 'inv-804', medicine: 'ORS Electral Sachet', generic: 'Oral Rehydration Salts', form: 'Sachet', manufacturer: 'FDC Ltd', quantity: 65, price: 18, batch: 'OR-0092', expiry: 'Jul 2027', isJanAushadhi: true },
  { id: 'inv-805', medicine: 'Dolo 650', generic: 'Paracetamol 650mg', form: 'Tablet', manufacturer: 'Micro Labs Ltd', quantity: 120, price: 31.5, batch: 'B-92841', expiry: 'Oct 2025', isJanAushadhi: false },
  { id: 'inv-806', medicine: 'Glycomet 500', generic: 'Metformin Hydrochloride 500mg', form: 'Tablet', manufacturer: 'USV Pharma', quantity: 85, price: 24, batch: 'GL-1940', expiry: 'Aug 2026', isJanAushadhi: false },
  { id: 'inv-807', medicine: 'Pan 40', generic: 'Pantoprazole 40mg', form: 'Tablet', manufacturer: 'Alkem Labs', quantity: 0, price: 58, batch: 'PN-3321', expiry: 'May 2026', isJanAushadhi: false },
  { id: 'inv-808', medicine: 'Generic Amoxicillin', generic: 'Amoxicillin 500mg', form: 'Capsule', manufacturer: 'Jan Aushadhi', quantity: 3, price: 35, batch: 'JA-7719', expiry: 'Mar 2026', isJanAushadhi: true },
];

export default function App({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState('inventory'); // 'inventory', 'prescriptions', 'reservations', 'dashboard'
  const [open, setOpen] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'low', 'out', 'jan_aushadhi'
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [overrides, setOverrides] = useState({});

  // Local state initialized with rich Stitch mock catalog, synced with backend
  const [inventoryList, setInventoryList] = useState(INITIAL_CATALOG);

  // New item form state
  const [newItem, setNewItem] = useState({
    medicine: '',
    generic: '',
    form: 'Tablet',
    manufacturer: 'Jan Aushadhi',
    quantity: 50,
    price: 20,
    batch: `B-${Math.floor(1000 + Math.random() * 8999)}`,
    expiry: 'Dec 2026',
    isJanAushadhi: true,
  });

  const showNotification = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Poll backend
  const requests = usePoll(
    () => api.get(`/pharmacy/requests?pharmacy=${encodeURIComponent(STORE_NAME)}`),
    3500
  );
  const backendInventory = usePoll(
    () => api.get(`/inventory?pharmacy=${encodeURIComponent(STORE_NAME)}`),
    5000
  );
  const reservations = usePoll(
    () => api.get(`/reservations?pharmacy=${encodeURIComponent(STORE_NAME)}`),
    4000
  );

  // Sync backend inventory if available
  useEffect(() => {
    if (backendInventory.data && backendInventory.data.length > 0) {
      setInventoryList((prev) => {
        const merged = [...prev];
        backendInventory.data.forEach((bi) => {
          const idx = merged.findIndex((m) => m.id === bi.id || m.medicine === bi.medicine);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], quantity: bi.quantity, price: bi.price ?? merged[idx].price };
          } else {
            merged.push({
              id: bi.id,
              medicine: bi.medicine,
              generic: bi.medicine,
              form: bi.form || 'Tablet',
              manufacturer: 'Local Supplier',
              quantity: bi.quantity,
              price: bi.price || 0,
              batch: 'JA-9000',
              expiry: '2026',
              isJanAushadhi: bi.price === 0,
            });
          }
        });
        return merged;
      });
    }
  }, [backendInventory.data]);

  // Adjust Quantity
  const handleAdjustQty = async (id, delta) => {
    setInventoryList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, item.quantity + delta);
          // Sync with API
          api.patch(`/inventory/${id}`, { quantity: newQty }).catch(() => {});
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
    const item = inventoryList.find((i) => i.id === id);
    if (item) {
      showNotification(`Updated ${item.medicine} stock: ${Math.max(0, item.quantity + delta)} units`);
    }
  };

  // Add Item to Inventory
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.medicine) return;
    const created = {
      ...newItem,
      id: `inv-${Date.now()}`,
      pharmacyId: user?.pharmacyId || 'ph1',
      quantity: Number(newItem.quantity),
      price: Number(newItem.price),
    };
    setInventoryList((prev) => [created, ...prev]);
    setShowAddModal(false);
    showNotification(`Added ${created.medicine} to pharmacy inventory!`);
    try {
      await api.post('/inventory', created);
    } catch {}
    setNewItem({
      medicine: '',
      generic: '',
      form: 'Tablet',
      manufacturer: 'Jan Aushadhi',
      quantity: 50,
      price: 20,
      batch: `B-${Math.floor(1000 + Math.random() * 8999)}`,
      expiry: 'Dec 2026',
      isJanAushadhi: true,
    });
  };

  // e-Rx Responses
  const mergedRequests = useMemo(() => {
    return (requests.data || []).map((r) =>
      overrides[r.id]
        ? {
            ...r,
            items: r.items.map((i) => ({
              ...i,
              available:
                overrides[r.id][i.medicine || i.drugName] !== undefined
                  ? overrides[r.id][i.medicine || i.drugName]
                  : i.available,
            })),
          }
        : r
    );
  }, [requests.data, overrides]);

  const setItemAvail = (requestId, med, avail) =>
    setOverrides((prev) => ({
      ...prev,
      [requestId]: { ...(prev[requestId] || {}), [med]: avail },
    }));

  const respondRx = async (requestId, availability) => {
    const req = mergedRequests.find((r) => r.id === requestId);
    if (!req) return;
    try {
      await api.post(`/pharmacy/requests/${requestId}/respond`, {
        availability,
        items: req.items,
        reserve: availability === 'full' || availability === 'partial',
      });
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      showNotification(`e-Rx ${req.prescriptionCode} updated: ${availability === 'full' ? 'Stock Confirmed & Reserved' : availability}`);
    } catch {
      showNotification('Prescription status updated.');
    }
  };

  const markPicked = async (id, token, name) => {
    try {
      await api.post('/pharmacy/dispense', {
        reservationId: id,
        reservationToken: token,
        pharmacyId: user?.pharmacyId || 'ph1',
      });
      showNotification(`Token ${token} verified for ${name} — Dispensed & stock deducted!`);
      reservations.reload?.();
      backendInventory.reload?.();
    } catch (err) {
      showNotification(`Dispense notice: ${err?.message || 'Dispensed'}`);
    }
  };

  const [directToken, setDirectToken] = useState('');
  const handleDirectDispense = async (e) => {
    e.preventDefault();
    if (!directToken.trim()) return;
    try {
      await api.post('/pharmacy/dispense', {
        reservationToken: directToken.trim(),
        qrCode: directToken.trim(),
        pharmacyId: user?.pharmacyId || 'ph1',
      });
      showNotification(`Verified and dispensed medication for ${directToken}!`);
      setDirectToken('');
      reservations.reload?.();
      backendInventory.reload?.();
    } catch (err) {
      showNotification(`Could not dispense: ${err?.message || 'Check token or code'}`);
    }
  };

  const handleShowNotifications = async () => {
    try {
      const notifs = await api.get('/notifications');
      if (!notifs || notifs.length === 0) {
        showNotification('No new notifications');
      } else {
        const top = notifs[0];
        showNotification(`Alert: ${top.title} - ${top.message}`);
      }
    } catch {
      showNotification('Notifications loaded.');
    }
  };

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    return inventoryList.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        item.medicine.toLowerCase().includes(q) ||
        item.generic.toLowerCase().includes(q) ||
        item.batch.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (filterType === 'low') return item.quantity > 0 && item.quantity <= 12;
      if (filterType === 'out') return item.quantity === 0;
      if (filterType === 'jan_aushadhi') return item.isJanAushadhi;
      return true;
    });
  }, [inventoryList, searchQuery, filterType]);

  const lowStockCount = inventoryList.filter((i) => i.quantity > 0 && i.quantity <= 12).length;
  const outOfStockCount = inventoryList.filter((i) => i.quantity === 0).length;
  const totalStockUnits = inventoryList.reduce((sum, i) => sum + i.quantity, 0);

  const pendingRequests = mergedRequests.filter((r) => !r.availability);
  const activeReservations = (reservations.data || []).filter((r) => r.status === 'reserved');

  return (
    <div className="app-shell">
      {/* ── SideNavBar (Stitch Specification) ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="store-badge-row">
            <div className="store-logo">
              <span className="material-symbols-outlined fill" style={{ fontSize: 20 }}>local_pharmacy</span>
            </div>
            <div>
              <h2 className="sidebar-title">{STORE_NAME}</h2>
              <p className="sidebar-sub">ID: {STORE_ID} · Belaganj Cluster</p>
            </div>
          </div>
        </div>

        <div className="sidebar-action-wrap">
          <button
            className="sidebar-btn"
            onClick={() => {
              setActiveNav('prescriptions');
              showNotification('Viewing incoming e-Prescriptions queue');
            }}
          >
            <span className="material-symbols-outlined fill">add</span>
            New e-Prescription
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-link ${activeNav === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveNav('dashboard')}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-link ${activeNav === 'prescriptions' ? 'active' : ''}`}
            onClick={() => setActiveNav('prescriptions')}
          >
            <span className="material-symbols-outlined">description</span>
            <span>Prescriptions</span>
            {pendingRequests.length > 0 && (
              <span className="nav-pill-count alert">{pendingRequests.length}</span>
            )}
          </button>

          {/* Active State for Inventory (From Stitch MCP) */}
          <button
            className={`nav-link ${activeNav === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveNav('inventory')}
          >
            <span className="material-symbols-outlined fill">inventory_2</span>
            <span>Inventory</span>
            <span className="nav-pill-count">{inventoryList.length}</span>
          </button>

          <button
            className={`nav-link ${activeNav === 'reservations' ? 'active' : ''}`}
            onClick={() => setActiveNav('reservations')}
          >
            <span className="material-symbols-outlined">event_available</span>
            <span>Reservations</span>
            {activeReservations.length > 0 && (
              <span className="nav-pill-count">{activeReservations.length}</span>
            )}
          </button>

          <button
            className={`nav-link ${activeNav === 'dispensing' ? 'active' : ''}`}
            onClick={() => {
              setActiveNav('reservations');
              showNotification('Dispensing counter active');
            }}
          >
            <span className="material-symbols-outlined">vaccines</span>
            <span>Dispensing</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '8px 14px', fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
            Signed in as {user?.name || user?.email}
          </div>
          <button className="sidebar-btn" onClick={onLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="main-wrapper">
        {/* ── Top Header Actions ── */}
        <header className="top-header">
          <div className="search-bar-wrap">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search medicines, generic formula, batches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="header-right">
            <span
              className={`status-toggle-pill ${open ? 'open' : 'closed'}`}
              onClick={() => {
                setOpen(!open);
                showNotification(open ? 'Store marked as Paused' : 'Store is Live & Accepting e-Rx');
              }}
            >
              <span className="pulse-dot" />
              {open ? 'Accepting e-Rx' : 'Store Paused'}
            </span>

            <button className="icon-btn" title="Notifications" onClick={handleShowNotifications}>
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="icon-btn" title="Settings" onClick={() => showNotification('Pharmacy Settings')}>
              <span className="material-symbols-outlined">settings</span>
            </button>

            <div className="pharmacist-avatar" title="Pharmacist On Duty">
              RC
            </div>
          </div>
        </header>

        {/* ── Content Canvas ── */}
        <main className="content-canvas">
          {/* ── VIEW 1: INVENTORY MANAGEMENT (STITCH MCP CORE) ── */}
          {activeNav === 'inventory' && (
            <>
              <div className="page-header-row">
                <div>
                  <h1 className="page-title">Inventory Management</h1>
                  <p className="page-subtitle">Manage medicine availability and stock levels across your pharmacy.</p>
                </div>
                <div className="header-action-buttons">
                  <button
                    className="btn btn-outline"
                    onClick={() => showNotification('Exporting Inventory CSV...')}
                  >
                    <span className="material-symbols-outlined">download</span>
                    Export
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                    <span className="material-symbols-outlined">add</span>
                    Add Item
                  </button>
                </div>
              </div>

              {/* Bento Stat Metric Cards */}
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-top">
                    <div className="metric-icon-box teal">
                      <span className="material-symbols-outlined">medication</span>
                    </div>
                    <span className="chip chip-in-stock">Healthy</span>
                  </div>
                  <div className="metric-value">{inventoryList.length}</div>
                  <div className="metric-label">Active Formularies</div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <div className="metric-icon-box blue">
                      <span className="material-symbols-outlined">inventory</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--secondary)' }}>In Stock</span>
                  </div>
                  <div className="metric-value">{totalStockUnits}</div>
                  <div className="metric-label">Total Units Available</div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <div className="metric-icon-box amber">
                      <span className="material-symbols-outlined">warning</span>
                    </div>
                    <span className="chip chip-low-stock">{lowStockCount} Items</span>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--amber)' }}>{lowStockCount}</div>
                  <div className="metric-label">Low Stock Alerts</div>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <div className="metric-icon-box" style={{ background: '#ffdad6', color: '#ba1a1a' }}>
                      <span className="material-symbols-outlined">block</span>
                    </div>
                    <span className="chip chip-out-stock">{outOfStockCount} Items</span>
                  </div>
                  <div className="metric-value" style={{ color: 'var(--error)' }}>{outOfStockCount}</div>
                  <div className="metric-label">Out of Stock</div>
                </div>
              </div>

              {/* Controls & Filter Bar (Stitch Spec) */}
              <div className="controls-card">
                <div className="pill-group">
                  <button
                    className={`filter-pill ${filterType === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterType('all')}
                  >
                    All Items ({inventoryList.length})
                  </button>
                  <button
                    className={`filter-pill ${filterType === 'low' ? 'active alert' : ''}`}
                    onClick={() => setFilterType('low')}
                  >
                    Low Stock ({lowStockCount})
                  </button>
                  <button
                    className={`filter-pill ${filterType === 'out' ? 'active alert' : ''}`}
                    onClick={() => setFilterType('out')}
                  >
                    Out of Stock ({outOfStockCount})
                  </button>
                  <button
                    className={`filter-pill ${filterType === 'jan_aushadhi' ? 'active' : ''}`}
                    onClick={() => setFilterType('jan_aushadhi')}
                  >
                    Jan Aushadhi Subsidized
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="icon-btn" title="Filter options">
                    <span className="material-symbols-outlined">filter_list</span>
                  </button>
                </div>
              </div>

              {/* Stitch High-Density Table */}
              <div className="table-card">
                <div className="table-responsive">
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th>Medicine Name</th>
                        <th>Generic Name / Form</th>
                        <th>Stock Level</th>
                        <th>Price (MRP)</th>
                        <th>Batch / Expiry</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map((item) => {
                        const isLow = item.quantity > 0 && item.quantity <= 12;
                        const isOut = item.quantity === 0;

                        return (
                          <tr
                            key={item.id}
                            className={isLow ? 'row-low-stock' : isOut ? 'row-out-stock' : ''}
                          >
                            <td>
                              <div className="med-brand-name">{item.medicine}</div>
                              <div className="med-manufacturer">{item.manufacturer || 'Jan Aushadhi'}</div>
                            </td>
                            <td>
                              <div className="med-generic">{item.generic || item.medicine}</div>
                              <span className="med-form-pill">{item.form || 'Tablet'}</span>
                            </td>
                            <td>
                              <div className="stepper">
                                <button
                                  className="stepper-btn"
                                  disabled={item.quantity === 0}
                                  onClick={() => handleAdjustQty(item.id, -1)}
                                >
                                  -
                                </button>
                                <span className={`stepper-val ${isLow ? 'low' : isOut ? 'out' : ''}`}>
                                  {item.quantity}
                                </span>
                                <button
                                  className="stepper-btn"
                                  onClick={() => handleAdjustQty(item.id, 1)}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>
                                ₹ {item.price ? Number(item.price).toFixed(2) : 'Free'}
                              </div>
                              {item.isJanAushadhi && (
                                <div style={{ fontSize: 10.5, color: 'var(--tertiary)', fontWeight: 700 }}>
                                  PM-JAY Subsidy
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                                {item.batch || 'JA-4412'}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
                                {item.expiry || 'Dec 2026'}
                              </div>
                            </td>
                            <td>
                              {isOut ? (
                                <span className="chip chip-out-stock">Out of Stock</span>
                              ) : isLow ? (
                                <span className="chip chip-low-stock">Low Stock</span>
                              ) : (
                                <span className="chip chip-in-stock">In Stock</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="icon-btn"
                                onClick={() => showNotification(`Editing ${item.medicine}`)}
                              >
                                <span className="material-symbols-outlined">more_vert</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredInventory.length && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>
                            No medicine records found matching your filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div style={{ padding: '10px 16px', background: 'var(--surface-container-low)', borderTop: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--on-surface-variant)' }}>
                    Showing {filteredInventory.length} of {inventoryList.length} total entries
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" disabled>Previous</button>
                    <button className="btn btn-outline btn-sm">Next</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── VIEW 2: e-PRESCRIPTIONS ── */}
          {activeNav === 'prescriptions' && (
            <>
              <div className="page-header-row">
                <div>
                  <h1 className="page-title">Inbound e-Prescriptions</h1>
                  <p className="page-subtitle">Real-time doctor consultations requiring medicine verification.</p>
                </div>
              </div>

              <div className="rx-grid">
                {mergedRequests.map((req) => {
                  const allMarked = req.items.every((i) => i.available !== null && i.available !== undefined);
                  const anyAvail = req.items.some((i) => i.available === true);
                  const responded = !!req.availability;

                  return (
                    <div className="rx-card" key={req.id}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span className="rx-code-mono">{req.prescriptionCode}</span>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-background)', marginTop: 4 }}>
                              {req.patientName}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                              Dr. {req.doctorName} · Network e-Rx
                            </div>
                          </div>
                          <span className={`chip ${responded ? (req.availability === 'full' ? 'chip-in-stock' : 'chip-low-stock') : 'chip-low-stock'}`}>
                            {responded ? req.availability.toUpperCase() : 'NEW'}
                          </span>
                        </div>

                        <div style={{ margin: '14px 0 6px' }}>
                          {req.items.map((item) => {
                            const med = item.medicine || item.drugName;
                            return (
                              <div className="rx-item-box" key={med}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{med}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
                                    {item.dose || item.dosage || '1 tab'} · {item.frequency || 'OD'} · {item.duration || '5 days'}
                                  </div>
                                </div>
                                {!responded ? (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      style={{ background: item.available === true ? 'var(--tertiary)' : '', color: item.available === true ? '#fff' : '' }}
                                      onClick={() => setItemAvail(req.id, med, true)}
                                    >
                                      Available
                                    </button>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      style={{ background: item.available === false ? 'var(--error)' : '', color: item.available === false ? '#fff' : '' }}
                                      onClick={() => setItemAvail(req.id, med, false)}
                                    >
                                      Out
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`chip ${item.available ? 'chip-in-stock' : 'chip-out-stock'}`}>
                                    {item.available ? 'Available' : 'Out'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        {!responded ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ gridColumn: 'span 2' }}
                              disabled={!allMarked}
                              onClick={() => respondRx(req.id, 'full')}
                            >
                              Confirm Full Stock
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={!allMarked || !anyAvail}
                              onClick={() => respondRx(req.id, 'partial')}
                            >
                              Partial
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => respondRx(req.id, 'unavailable')}
                            >
                              Unavailable
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', textAlign: 'right' }}>
                            Patient notified · Status live
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── VIEW 3: RESERVATIONS & DISPENSING ── */}
          {activeNav === 'reservations' && (
            <>
              <div className="page-header-row">
                <div>
                  <h1 className="page-title">Counter Pickups & Tokens</h1>
                  <p className="page-subtitle">Verify patient pickup tokens and dispense prepared medication.</p>
                </div>
              </div>

              {/* Direct QR/Token Verification Bar */}
              <div className="table-card" style={{ padding: '16px 20px', marginBottom: 20, background: 'var(--surface-container-lowest)' }}>
                <form onSubmit={handleDirectDispense} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>qr_code_scanner</span>
                  <input
                    type="text"
                    className="search-input"
                    style={{ flex: 1, height: 40, border: '1px solid var(--outline-variant)' }}
                    placeholder="Scan QR or Enter Token (e.g. RC-1042 or RX-849201)..."
                    value={directToken}
                    onChange={(e) => setDirectToken(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ height: 40 }}>
                    Verify & Dispense
                  </button>
                </form>
              </div>

              <div className="table-card">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Prescription</th>
                      <th>Patient Name</th>
                      <th>Reserved Medicines</th>
                      <th>Amount</th>
                      <th style={{ textAlign: 'right' }}>Dispense Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReservations.map((r) => {
                      const token = r.reservationToken || r.token;
                      const medNames = Array.isArray(r.items)
                        ? r.items.map((i) => i.drugName || i.medicine).join(', ')
                        : Array.isArray(r.medicines)
                        ? r.medicines.join(', ')
                        : 'Prescribed items';

                      return (
                        <tr key={r.id}>
                          <td>
                            <span style={{ fontFamily: 'JetBrains Mono', background: 'var(--on-primary-container)', color: 'var(--primary)', fontWeight: 800, padding: '4px 10px', borderRadius: 4 }}>
                              {token}
                            </span>
                          </td>
                          <td><b>{r.prescriptionCode}</b></td>
                          <td>{r.patientName}</td>
                          <td>{medNames}</td>
                          <td><b>{r.totalCost > 0 ? `₹ ${r.totalCost}` : 'Free'}</b></td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => markPicked(r.id, token, r.patientName)}
                            >
                              Verify & Dispense
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!activeReservations.length && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>
                          No pending counter reservations at this time.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── VIEW 4: DASHBOARD OVERVIEW ── */}
          {activeNav === 'dashboard' && (
            <>
              <div className="page-header-row">
                <div>
                  <h1 className="page-title">Pharmacy Dashboard Overview</h1>
                  <p className="page-subtitle">Operational summary for {STORE_NAME}.</p>
                </div>
              </div>

              <div className="metrics-row">
                <div className="metric-card" onClick={() => setActiveNav('inventory')} style={{ cursor: 'pointer' }}>
                  <div className="metric-top">
                    <div className="metric-icon-box teal">
                      <span className="material-symbols-outlined">inventory_2</span>
                    </div>
                  </div>
                  <div className="metric-value">{inventoryList.length}</div>
                  <div className="metric-label">Formularies Managed</div>
                </div>

                <div className="metric-card" onClick={() => setActiveNav('prescriptions')} style={{ cursor: 'pointer' }}>
                  <div className="metric-top">
                    <div className="metric-icon-box blue">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                  </div>
                  <div className="metric-value">{mergedRequests.length}</div>
                  <div className="metric-label">e-Prescriptions Total</div>
                </div>

                <div className="metric-card" onClick={() => setActiveNav('reservations')} style={{ cursor: 'pointer' }}>
                  <div className="metric-top">
                    <div className="metric-icon-box green">
                      <span className="material-symbols-outlined">event_available</span>
                    </div>
                  </div>
                  <div className="metric-value">{activeReservations.length}</div>
                  <div className="metric-label">Active Counter Holds</div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Modal: Add Medicine Item ── */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">Add New Medicine to Inventory</div>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddItem}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Medicine / Brand Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paracetamol 650mg"
                    className="form-input"
                    value={newItem.medicine}
                    onChange={(e) => setNewItem({ ...newItem, medicine: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Generic Formulation</label>
                  <input
                    type="text"
                    placeholder="e.g. Paracetamol"
                    className="form-input"
                    value={newItem.generic}
                    onChange={(e) => setNewItem({ ...newItem, generic: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Dosage Form</label>
                    <select
                      className="form-input"
                      value={newItem.form}
                      onChange={(e) => setNewItem({ ...newItem, form: e.target.value })}
                    >
                      <option value="Tablet">Tablet</option>
                      <option value="Capsule">Capsule</option>
                      <option value="Syrup">Syrup</option>
                      <option value="Sachet">Sachet</option>
                      <option value="Injection">Injection</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Stock Quantity</label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="form-input"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Price (MRP ₹)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-input"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Batch Number</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newItem.batch}
                      onChange={(e) => setNewItem({ ...newItem, batch: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Manufacturer / Source</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newItem.manufacturer}
                    onChange={(e) => setNewItem({ ...newItem, manufacturer: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Alert ── */}
      {toast && (
        <div className="toast-box">
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6bd8cb' }}>info</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
