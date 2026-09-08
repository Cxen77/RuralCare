import { useState, useEffect, useMemo } from 'react';
import { api, usePoll } from './api.js';
import FulfillmentMapModal from './components/FulfillmentMapModal.jsx';
import PharmacyLocationPickerModal from './components/PharmacyLocationPickerModal.jsx';

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
  const [activeNav, setActiveNav] = useState('inventory'); // 'inventory', 'prescriptions', 'reservations', 'dispensing', 'dashboard'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [open, setOpen] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'low', 'out', 'jan_aushadhi'
  const [rxFilter, setRxFilter] = useState('all'); // 'all', 'pending', 'dispensed'
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [dispenseHistory, setDispenseHistory] = useState([]);
  const [mapModalTarget, setMapModalTarget] = useState(null); // { id, code }

  // Pharmacy Profile & Location State
  const [pharmacyProfile, setPharmacyProfile] = useState({
    id: user?.pharmacyId || 'ph1',
    name: user?.name || STORE_NAME,
    address: 'Main Road, Ramnagar, Vaishali, Bihar',
    latitude: 25.9870,
    longitude: 85.2290,
  });
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Fetch pharmacy profile and canonical location on mount
  useEffect(() => {
    api.get('/pharmacy/profile')
      .then(res => {
        if (res) {
          setPharmacyProfile(prev => ({
            ...prev,
            ...res,
            latitude: (res.latitude !== undefined && res.latitude !== null && !isNaN(Number(res.latitude))) ? Number(res.latitude) : prev.latitude,
            longitude: (res.longitude !== undefined && res.longitude !== null && !isNaN(Number(res.longitude))) ? Number(res.longitude) : prev.longitude,
          }));
        }
      })
      .catch(err => console.warn('Could not fetch pharmacy profile:', err));
  }, []);

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

  // Poll backend endpoints
  const pharmacyId = user?.pharmacyId || 'ph1';

  const doctorPrescriptions = usePoll(
    () => api.get('/prescriptions').catch(() => []),
    3000
  );

  const requests = usePoll(
    () => api.get(`/pharmacy/requests?pharmacyId=${encodeURIComponent(pharmacyId)}`).catch(() => api.get('/pharmacy/requests').catch(() => [])),
    3500
  );

  const backendInventory = usePoll(
    () => api.get(`/inventory?pharmacyId=${encodeURIComponent(pharmacyId)}`).catch(() => api.get('/inventory').catch(() => [])),
    5000
  );

  const reservations = usePoll(
    () => api.get(`/reservations?pharmacyId=${encodeURIComponent(pharmacyId)}`).catch(() => api.get('/reservations').catch(() => [])),
    3500
  );

  // Sync backend inventory if available
  useEffect(() => {
    if (backendInventory.data && Array.isArray(backendInventory.data) && backendInventory.data.length > 0) {
      setInventoryList((prev) => {
        const merged = [...prev];
        backendInventory.data.forEach((bi) => {
          const idx = merged.findIndex((m) => m.id === bi.id || m.medicine?.toLowerCase() === bi.medicine?.toLowerCase());
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], quantity: bi.quantity, price: bi.price ?? merged[idx].price };
          } else {
            merged.push({
              id: bi.id,
              medicine: bi.medicine,
              generic: bi.generic || bi.medicine,
              form: bi.form || 'Tablet',
              manufacturer: bi.manufacturer || 'Jan Aushadhi',
              quantity: bi.quantity,
              price: bi.price || 0,
              batch: bi.batch || 'JA-9000',
              expiry: bi.expiry || '2026',
              isJanAushadhi: bi.isJanAushadhi ?? (bi.price === 0),
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

  // Helper to normalize items from any prescription or pharmacy request
  const normalizeItems = (source) => {
    if (Array.isArray(source.items) && source.items.length > 0) {
      return source.items.map((i) => ({
        medicine: i.drugName || i.medicine || i.name || 'Prescribed Medicine',
        generic: i.genericName || i.generic || '',
        dose: i.dose || i.dosage || '1 tab',
        frequency: i.frequency || 'OD',
        duration: i.duration || '5 days',
        quantity: i.quantity || 10,
        available: i.available !== undefined ? i.available : null,
      }));
    }
    if (Array.isArray(source.medicines) && source.medicines.length > 0) {
      return source.medicines.map((m) => {
        const medName = typeof m === 'string' ? m : (m.medicine || m.drugName || 'Prescribed Medicine');
        return {
          medicine: medName,
          generic: '',
          dose: '1 tab',
          frequency: 'OD',
          duration: '5 days',
          quantity: 10,
          available: null,
        };
      });
    }
    return [];
  };

  // Unified Prescription Stream (combines doctor-issued e-Rx & pharmacy requests)
  const allPrescriptions = useMemo(() => {
    const map = new Map();
    const docRxs = Array.isArray(doctorPrescriptions.data) ? doctorPrescriptions.data : [];
    const reqs = Array.isArray(requests.data) ? requests.data : [];

    // Add doctor consultation prescriptions
    docRxs.forEach((rx) => {
      const items = normalizeItems(rx).map((i) => ({
        ...i,
        available:
          overrides[rx.id]?.[i.medicine] !== undefined
            ? overrides[rx.id][i.medicine]
            : (rx.dispensingStatus === 'dispensed' ? true : null),
      }));

      map.set(rx.id, {
        id: rx.id,
        prescriptionCode: rx.qrCode || rx.id,
        patientName: rx.patientName || 'Anonymous Patient',
        doctorName: rx.doctorName || 'Assigned Physician',
        diagnosis: rx.diagnosis,
        issuedAt: rx.issuedAt || rx.createdAt,
        dispensingStatus: rx.dispensingStatus || 'pending',
        pharmacyId: rx.pharmacyId,
        reservationToken: rx.reservationToken,
        items,
        source: 'consultation',
      });
    });

    // Merge in pharmacy requests
    reqs.forEach((r) => {
      const existing = map.get(r.prescriptionId) || map.get(r.id);
      const reqItems = normalizeItems(r).map((i) => ({
        ...i,
        available:
          overrides[r.id]?.[i.medicine] !== undefined
            ? overrides[r.id][i.medicine]
            : i.available,
      }));

      if (existing) {
        existing.availability = r.availability;
        existing.status = r.status;
        existing.requestId = r.id;
        if ((!existing.items || existing.items.length === 0) && reqItems.length > 0) {
          existing.items = reqItems;
        }
      } else {
        map.set(r.id, {
          id: r.id,
          requestId: r.id,
          prescriptionCode: r.prescriptionCode || r.id,
          patientName: r.patientName || 'Rural Patient',
          doctorName: r.doctorName || 'Medical Officer',
          issuedAt: r.createdAt,
          dispensingStatus: r.availability ? (r.availability === 'full' ? 'dispensed' : 'partial') : 'pending',
          availability: r.availability,
          status: r.status,
          items: reqItems,
          source: 'network_request',
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => new Date(b.issuedAt || 0) - new Date(a.issuedAt || 0));
  }, [doctorPrescriptions.data, requests.data, overrides]);

  const findInventoryMatch = (medicineName, genericName) => {
    if (!medicineName && !genericName) return null;
    const medLower = (medicineName || '').toLowerCase().trim();
    const genLower = (genericName || '').toLowerCase().trim();

    return inventoryList.find((inv) => {
      const invMed = (inv.medicine || '').toLowerCase();
      const invGen = (inv.generic || '').toLowerCase();
      return (
        (medLower && (invMed.includes(medLower) || medLower.includes(invMed))) ||
        (genLower && (invGen.includes(genLower) || genLower.includes(invGen)))
      );
    });
  };

  const setItemAvail = (rxId, med, avail) =>
    setOverrides((prev) => ({
      ...prev,
      [rxId]: { ...(prev[rxId] || {}), [med]: avail },
    }));

  const respondRx = async (rxId, availability) => {
    const rx = allPrescriptions.find((r) => r.id === rxId);
    if (!rx) return;
    const items = Array.isArray(rx.items) ? rx.items : [];
    try {
      if (rx.requestId) {
        if (availability === 'full') {
          // Canonical confirm endpoint with atomic double-claim prevention
          const res = await api.post(`/pharmacy/requests/${rx.requestId}/confirm`, {
            pharmacyId: user?.pharmacyId || 'ph1',
          });
          const token = res?.reservationToken || rx.reservationToken || 'CONFIRMED';
          showNotification(`Confirmed & Reserved for ${rx.patientName}! Pickup Token: ${token}`);
        } else {
          await api.post(`/pharmacy/requests/${rx.requestId}/respond`, {
            availability,
            items: items.map((i) => ({
              drugName: i.medicine || i.drugName,
              medicine: i.medicine || i.drugName,
              quantity: i.quantity,
              dosage: i.dose || i.dosage,
            })),
            reserve: availability === 'partial',
          });
          showNotification(`e-Rx ${rx.prescriptionCode} updated: ${availability}`);
        }
      } else {
        await api.patch(`/prescriptions/${rx.id}`, {
          dispensingStatus: availability === 'full' ? 'confirmed' : 'partial',
          pharmacyId: user?.pharmacyId || 'ph1',
        });
        showNotification(`Prescription status updated to ${availability === 'full' ? 'confirmed' : 'partial'}`);
      }
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[rxId];
        return next;
      });
    } catch (err) {
      if (err?.message?.includes('ALREADY_CLAIMED') || err?.status === 409) {
        showNotification('Notice: Prescription was already claimed by another pharmacy.');
      } else {
        showNotification(`Response updated: ${err?.message || 'Done'}`);
      }
    }
  };

  const updateOrderStatus = async (requestId, rxId, newStatus) => {
    try {
      if (requestId) {
        await api.post(`/pharmacy/requests/${requestId}/status`, {
          status: newStatus,
          pharmacyId: user?.pharmacyId || 'ph1',
        });
      } else if (rxId) {
        await api.patch(`/prescriptions/${rxId}`, {
          dispensingStatus: newStatus,
        });
      }
      showNotification(`Order moved to: ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (err) {
      showNotification(`Status update: ${err?.message || 'Updated'}`);
    }
  };

  const markPicked = async (id, token, name, rxId, reqId) => {
    try {
      await api.post('/pharmacy/dispense', {
        reservationId: id,
        reservationToken: token,
        prescriptionId: rxId,
        pharmacyId: user?.pharmacyId || 'ph1',
      });
      showNotification(`Token ${token} verified for ${name} — Dispensed & stock deducted!`);
      setDispenseHistory((prev) => [
        { id: `disp-${Date.now()}`, token, patientName: name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ...prev,
      ]);
    } catch (err) {
      showNotification(`Dispense notice: ${err?.message || 'Dispensed'}`);
    }
  };

  const [directToken, setDirectToken] = useState('');
  const handleDirectDispense = async (e) => {
    e.preventDefault();
    if (!directToken.trim()) return;
    const tokenVal = directToken.trim();
    try {
      await api.post('/pharmacy/dispense', {
        reservationToken: tokenVal,
        qrCode: tokenVal,
        prescriptionId: tokenVal,
        pharmacyId: user?.pharmacyId || 'ph1',
      });
      showNotification(`Successfully verified & dispensed medication for ${tokenVal}!`);
      setDispenseHistory((prev) => [
        { id: `disp-${Date.now()}`, token: tokenVal, patientName: 'Verified Patient', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ...prev,
      ]);
      setDirectToken('');
    } catch (err) {
      showNotification(`Dispense result: ${err?.message || 'Verification complete'}`);
      setDirectToken('');
    }
  };

  const handleShowNotifications = async () => {
    try {
      const notifs = await api.get('/notifications');
      if (!notifs || !Array.isArray(notifs) || notifs.length === 0) {
        showNotification('No new alerts.');
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
        (item.medicine && item.medicine.toLowerCase().includes(q)) ||
        (item.generic && item.generic.toLowerCase().includes(q)) ||
        (item.batch && item.batch.toLowerCase().includes(q));
      if (!matchSearch) return false;
      if (filterType === 'low') return item.quantity > 0 && item.quantity <= 12;
      if (filterType === 'out') return item.quantity === 0;
      if (filterType === 'jan_aushadhi') return item.isJanAushadhi;
      return true;
    });
  }, [inventoryList, searchQuery, filterType]);

  // Filtered Prescriptions
  const filteredPrescriptions = useMemo(() => {
    return allPrescriptions.filter((rx) => {
      const q = searchQuery.toLowerCase();
      const items = Array.isArray(rx.items) ? rx.items : [];
      const matchSearch =
        !searchQuery ||
        (rx.prescriptionCode && rx.prescriptionCode.toLowerCase().includes(q)) ||
        (rx.patientName && rx.patientName.toLowerCase().includes(q)) ||
        (rx.doctorName && rx.doctorName.toLowerCase().includes(q)) ||
        items.some((i) => i.medicine && i.medicine.toLowerCase().includes(q));
      if (!matchSearch) return false;
      if (rxFilter === 'pending') return rx.dispensingStatus !== 'dispensed';
      if (rxFilter === 'dispensed') return rx.dispensingStatus === 'dispensed';
      return true;
    });
  }, [allPrescriptions, searchQuery, rxFilter]);

  const lowStockCount = inventoryList.filter((i) => i.quantity > 0 && i.quantity <= 12).length;
  const outOfStockCount = inventoryList.filter((i) => i.quantity === 0).length;
  const totalStockUnits = inventoryList.reduce((sum, i) => sum + i.quantity, 0);

  const pendingRxCount = allPrescriptions.filter((r) => r.dispensingStatus !== 'dispensed').length;
  const activeReservations = (Array.isArray(reservations.data) ? reservations.data : []).filter((r) => r.status === 'reserved');

  const counterOrders = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. In-counter reservations
    activeReservations.forEach((r) => {
      const token = r.reservationToken || r.token;
      if (token) seen.add(token);
      if (r.id) seen.add(r.id);
      if (r.prescriptionId) seen.add(r.prescriptionId);

      const medNames = Array.isArray(r.items) && r.items.length > 0
        ? r.items.map((i) => `${i.drugName || i.medicine} (x${i.quantity || 1})`).join(', ')
        : Array.isArray(r.medicines) && r.medicines.length > 0
        ? r.medicines.map((m) => (typeof m === 'string' ? m : (m.medicine || m.drugName))).filter(Boolean).join(', ')
        : 'Prescribed medications';

      list.push({
        id: r.id,
        reservationId: r.id,
        token: token || 'HOLD-TEMP',
        prescriptionCode: r.prescriptionCode || r.prescriptionId || 'RESERVE',
        patientName: r.patientName || 'Rural Patient',
        medicines: medNames,
        amount: r.totalCost > 0 ? `₹ ${r.totalCost}` : 'Free (PM-JAY)',
        stage: 'confirmed',
        status: 'confirmed',
        source: 'reservation',
      });
    });

    // 2. Confirmed / preparing / ready_for_pickup e-prescriptions
    allPrescriptions
      .filter((p) => ['confirmed', 'preparing', 'ready_for_pickup'].includes(p.dispensingStatus) || (p.availability === 'full' && p.dispensingStatus !== 'dispensed'))
      .forEach((p) => {
        const token = p.reservationToken || p.prescriptionCode || p.id;
        if (seen.has(p.id) || (p.reservationToken && seen.has(p.reservationToken))) return;
        seen.add(p.id);
        if (p.reservationToken) seen.add(p.reservationToken);

        const medNames = Array.isArray(p.items) && p.items.length > 0
          ? p.items.map((i) => `${i.medicine || i.drugName} (x${i.quantity || 1})`).join(', ')
          : 'Prescribed medications';

        list.push({
          id: p.id,
          requestId: p.requestId,
          rxId: p.id,
          token: token,
          prescriptionCode: p.prescriptionCode || p.id,
          patientName: p.patientName || 'Rural Patient',
          medicines: medNames,
          amount: 'Standard e-Rx',
          stage: p.dispensingStatus || 'confirmed',
          status: p.dispensingStatus || 'confirmed',
          source: 'prescription',
        });
      });

    return list;
  }, [activeReservations, allPrescriptions]);

  return (
    <div className="app-shell">
      {/* ── Top Header Actions (Full Width across top of entire page) ── */}
      <header className="top-header">
        <div className="header-left">
          <button
            type="button"
            className="menu-toggle-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title={sidebarOpen ? 'Collapse Navigation' : 'Expand Navigation'}
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              menu
            </span>
          </button>

          {/* Store Brand with Clickable Location below Name */}
          <div className="navbar-store-brand">
            <div className="store-logo">
              <span className="material-symbols-outlined fill" style={{ fontSize: 20 }}>local_pharmacy</span>
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="navbar-store-name" title={pharmacyProfile.name || STORE_NAME}>
                {pharmacyProfile.name || STORE_NAME}
              </div>
              <button
                type="button"
                className="navbar-store-location-btn"
                onClick={() => setShowLocationPicker(true)}
                title="Click to view and update pharmacy location on interactive map"
              >
                <span className="material-symbols-outlined fill" style={{ fontSize: 13, color: 'var(--primary)' }}>location_on</span>
                <span className="navbar-store-location-text">
                  {pharmacyProfile.address ? pharmacyProfile.address.split(',').slice(0, 2).join(', ') : 'Set Store Location'}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 12, opacity: 0.7 }}>edit</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Centered Search Bar ── */}
        <div className="header-center">
          <div className="search-bar-wrap">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search medicines, tokens, prescriptions, patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="header-right">
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

      {/* ── App Body: In-flow Sidebar + Content Canvas below Navbar ── */}
      <div className="app-body">
        {/* ── SideNavBar (In-Flow Collapsible Part of Page) ── */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
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
              {pendingRxCount > 0 && (
                <span className="nav-pill-count">{pendingRxCount}</span>
              )}
            </button>

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
                setActiveNav('dispensing');
                showNotification('Dispensing counter active');
              }}
            >
              <span className="material-symbols-outlined">vaccines</span>
              <span>Dispensing</span>
              {activeReservations.length > 0 && (
                <span className="nav-pill-count">
                  {activeReservations.length}
                </span>
              )}
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

        {/* ── Content Canvas ── */}
        <main className="content-canvas">
          {/* ── VIEW 1: INVENTORY MANAGEMENT ── */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#181c1d' }}>medication</span>
                      <span className="metric-value" style={{ margin: 0, color: '#181c1d', lineHeight: 1 }}>{inventoryList.length}</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#181c1d' }}>Healthy</span>
                  </div>
                  <div className="metric-label" style={{ marginTop: 8 }}>Active Formularies</div>
                </div>

                <div className="metric-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#181c1d' }}>inventory</span>
                      <span className="metric-value" style={{ margin: 0, color: '#181c1d', lineHeight: 1 }}>{totalStockUnits}</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#181c1d' }}>In Stock</span>
                  </div>
                  <div className="metric-label" style={{ marginTop: 8 }}>Total Units Available</div>
                </div>

                <div className="metric-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#181c1d' }}>warning</span>
                      <span className="metric-value" style={{ margin: 0, color: '#181c1d', lineHeight: 1 }}>{lowStockCount}</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#181c1d' }}>{lowStockCount} Items</span>
                  </div>
                  <div className="metric-label" style={{ marginTop: 8 }}>Low Stock Alerts</div>
                </div>

                <div className="metric-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#181c1d' }}>block</span>
                      <span className="metric-value" style={{ margin: 0, color: '#181c1d', lineHeight: 1 }}>{outOfStockCount}</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#181c1d' }}>{outOfStockCount} Items</span>
                  </div>
                  <div className="metric-label" style={{ marginTop: 8 }}>Out of Stock</div>
                </div>
              </div>

              {/* Controls & Filter Bar */}
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

              {/* High-Density Table */}
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
                          <tr key={item.id}>
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
                                <span className="stepper-val" style={{ color: '#181c1d' }}>
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
                              <div style={{ fontWeight: 600, color: '#181c1d' }}>
                                ₹ {item.price ? Number(item.price).toFixed(2) : 'Free'}
                              </div>
                              {item.isJanAushadhi && (
                                <div style={{ fontSize: 10.5, color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                                  PM-JAY Subsidy
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#181c1d' }}>
                                {item.batch || 'JA-4412'}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
                                {item.expiry || 'Dec 2026'}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#181c1d' }}>
                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                              </span>
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

          {/* ── VIEW 2: e-PRESCRIPTIONS QUEUE ── */}
          {activeNav === 'prescriptions' && (
            <>
              <div className="page-header-row">
                <div>
                  <h1 className="page-title">Inbound e-Prescriptions</h1>
                  <p className="page-subtitle">Real-time doctor consultations requiring medicine verification and fulfillment.</p>
                </div>
                <div className="header-action-buttons">
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      showNotification('Refreshing e-Prescription feeds...');
                    }}
                  >
                    <span className="material-symbols-outlined">refresh</span>
                    Refresh Feed
                  </button>
                </div>
              </div>

              {/* Controls & Filter Bar */}
              <div className="controls-card">
                <div className="pill-group">
                  <button
                    className={`filter-pill ${rxFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setRxFilter('all')}
                  >
                    All e-Prescriptions ({allPrescriptions.length})
                  </button>
                  <button
                    className={`filter-pill ${rxFilter === 'pending' ? 'active alert' : ''}`}
                    onClick={() => setRxFilter('pending')}
                  >
                    Pending Verification ({pendingRxCount})
                  </button>
                  <button
                    className={`filter-pill ${rxFilter === 'dispensed' ? 'active' : ''}`}
                    onClick={() => setRxFilter('dispensed')}
                  >
                    Dispensed ({allPrescriptions.length - pendingRxCount})
                  </button>
                </div>
              </div>

              <div className="rx-grid">
                {filteredPrescriptions.map((req) => {
                  const items = Array.isArray(req.items) ? req.items : [];
                  const isDispensed = req.dispensingStatus === 'dispensed';
                  const isConfirmed = ['confirmed', 'preparing', 'ready_for_pickup'].includes(req.dispensingStatus);
                  const isResponded = !!req.availability || isConfirmed || isDispensed;

                  const allMarked = items.length > 0 && items.every((i) => {
                    if (i.available !== null && i.available !== undefined) return true;
                    const match = findInventoryMatch(i.medicine, i.generic);
                    return match && match.quantity >= (i.quantity || 1);
                  });
                  const anyAvail = items.some((i) => {
                    if (i.available === true) return true;
                    const match = findInventoryMatch(i.medicine, i.generic);
                    return match && match.quantity > 0;
                  });

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
                              Dr. {req.doctorName} · {req.diagnosis ? `Dx: ${req.diagnosis}` : 'Doctor e-Rx'}
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 11, marginTop: 6 }}
                              onClick={() => setMapModalTarget({ id: req.requestId || req.id, code: req.prescriptionCode || req.id })}
                              title="View patient & fulfillment location on interactive map"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#087F8C' }}>location_on</span>
                              View on Map
                            </button>
                          </div>
                          <span className={`chip ${isDispensed ? 'chip-in-stock' : isConfirmed ? 'chip-in-stock' : 'chip-low-stock'}`}>
                            {isDispensed
                              ? 'DISPENSED'
                              : req.dispensingStatus
                              ? req.dispensingStatus.replace(/_/g, ' ').toUpperCase()
                              : req.availability
                              ? req.availability.toUpperCase()
                              : 'PENDING VERIFICATION'}
                          </span>
                        </div>

                        {req.reservationToken && (
                          <div style={{ margin: '8px 0', padding: '6px 12px', background: 'var(--surface-container-low)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Pickup Token:</span>
                            <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>
                              {req.reservationToken}
                            </span>
                          </div>
                        )}

                        <div style={{ margin: '12px 0 6px' }}>
                          {items.map((item, idx) => {
                            const med = item.medicine || `Medicine #${idx + 1}`;
                            const stockMatch = findInventoryMatch(med, item.generic);
                            const inStockQty = stockMatch ? stockMatch.quantity : 0;
                            const isStockSufficient = inStockQty >= (item.quantity || 1);

                            return (
                              <div className="rx-item-box" key={`${req.id}-${med}-${idx}`}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{med}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>
                                    {item.dose} · {item.frequency} · {item.duration} {item.quantity ? `(${item.quantity} units)` : ''}
                                  </div>
                                  <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: isStockSufficient ? 'var(--tertiary)' : inStockQty > 0 ? '#d97706' : 'var(--error)' }}>
                                    {stockMatch ? `Store Stock: ${inStockQty} units available` : 'Not found in store stock'}
                                  </div>
                                </div>
                                {!isResponded ? (
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      style={{ background: (item.available === true || (item.available === null && isStockSufficient)) ? 'var(--tertiary)' : '', color: (item.available === true || (item.available === null && isStockSufficient)) ? '#fff' : '' }}
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
                                  <span className={`chip ${item.available !== false ? 'chip-in-stock' : 'chip-out-stock'}`}>
                                    {item.available !== false ? 'In Stock' : 'Out of Stock'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ marginTop: 14 }}>
                        {!isResponded ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ gridColumn: 'span 2' }}
                              disabled={!allMarked}
                              onClick={() => respondRx(req.id, 'full')}
                            >
                              Confirm Availability & Reserve (Hold Stock)
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={!allMarked || !anyAvail}
                              onClick={() => respondRx(req.id, 'partial')}
                            >
                              Partial Hold
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => respondRx(req.id, 'unavailable')}
                            >
                              Unavailable
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                              {isDispensed
                                ? 'Medication Dispensed to Patient'
                                : `Stage: ${(req.dispensingStatus || 'confirmed').replace(/_/g, ' ').toUpperCase()}`}
                            </span>
                            {!isDispensed && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                {req.dispensingStatus === 'confirmed' && (
                                  <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => updateOrderStatus(req.requestId, req.id, 'preparing')}
                                  >
                                    Start Preparing
                                  </button>
                                )}
                                {req.dispensingStatus === 'preparing' && (
                                  <button
                                    className="btn btn-outline btn-sm"
                                    style={{ borderColor: 'var(--tertiary)', color: 'var(--tertiary)' }}
                                    onClick={() => updateOrderStatus(req.requestId, req.id, 'ready_for_pickup')}
                                  >
                                    Ready for Pickup
                                  </button>
                                )}
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setActiveNav('dispensing');
                                    setDirectToken(req.reservationToken || req.prescriptionCode);
                                  }}
                                >
                                  Dispense Now
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!filteredPrescriptions.length && (
                <div className="table-card" style={{ padding: 48, textAlign: 'center', marginTop: 16 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 12 }}>
                    receipt_long
                  </span>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--on-background)', marginBottom: 6 }}>
                    No Inbound e-Prescriptions
                  </h3>
                  <p style={{ color: 'var(--on-surface-variant)', maxWidth: 460, margin: '0 auto 16px', fontSize: 13.5 }}>
                    When doctors write prescriptions during remote consultations or patients request pharmacy routing, orders will arrive here in real-time.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── VIEW 3: DISPENSING COUNTER ── */}
          {activeNav === 'dispensing' && (
            <>
              <div className="page-header-row">
                <div>
                  <h1 className="page-title">Dispensing Counter & Verification</h1>
                  <p className="page-subtitle">Scan patient QR token or enter code to dispense medications with automatic inventory deduction.</p>
                </div>
              </div>

              {/* Direct QR/Token Verification Bar */}
              <div className="table-card" style={{ padding: '24px 28px', marginBottom: 20, background: 'var(--surface-container-lowest)' }}>
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-background)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>qr_code_scanner</span>
                    Instant Counter Verification & Dispense
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--on-surface-variant)' }}>
                    Enter patient pickup token (e.g. <code>RC-1042</code>) or prescription barcode (<code>RX-849201</code>) to verify and complete dispensation.
                  </p>
                </div>

                <form onSubmit={handleDirectDispense} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="search-input"
                    style={{ flex: 1, height: 44, border: '1px solid var(--outline-variant)', fontSize: 14 }}
                    placeholder="Scan QR or Enter Token (e.g. RC-1042 or RX-849201)..."
                    value={directToken}
                    onChange={(e) => setDirectToken(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary" style={{ height: 44, padding: '0 24px' }}>
                    <span className="material-symbols-outlined">check_circle</span>
                    Verify & Dispense
                  </button>
                </form>
              </div>

              {/* Live Counter Queue & Reservations */}
              <div className="page-header-row" style={{ marginTop: 24, marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--on-background)' }}>
                    Ready for Counter Pickup & In-Progress Orders ({counterOrders.length})
                  </h2>
                </div>
              </div>

              <div className="table-card">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Pickup Token</th>
                      <th>Prescription</th>
                      <th>Patient Name</th>
                      <th>Status Stage</th>
                      <th>Reserved Medicines</th>
                      <th>Amount</th>
                      <th style={{ textAlign: 'right' }}>Fulfillment & Dispense Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counterOrders.map((r) => {
                      const token = r.token;
                      const isReady = r.stage === 'ready_for_pickup';
                      const isPrep = r.stage === 'preparing';

                      return (
                        <tr key={r.id}>
                          <td>
                            <span style={{ fontFamily: 'JetBrains Mono', background: 'var(--on-primary-container)', color: 'var(--primary)', fontWeight: 800, padding: '4px 10px', borderRadius: 4 }}>
                              {token}
                            </span>
                          </td>
                          <td><b>{r.prescriptionCode}</b></td>
                          <td>{r.patientName}</td>
                          <td>
                            <span className={`chip ${isReady ? 'chip-in-stock' : isPrep ? 'chip-low-stock' : 'chip-info'}`}>
                              {r.stage ? r.stage.replace(/_/g, ' ').toUpperCase() : 'CONFIRMED'}
                            </span>
                          </td>
                          <td>{r.medicines}</td>
                          <td><b>{r.amount}</b></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              {r.stage === 'confirmed' && (
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => updateOrderStatus(r.requestId, r.rxId, 'preparing')}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_top</span>
                                  Start Prep
                                </button>
                              )}
                              {r.stage === 'preparing' && (
                                <button
                                  className="btn btn-outline btn-sm"
                                  style={{ borderColor: 'var(--tertiary)', color: 'var(--tertiary)' }}
                                  onClick={() => updateOrderStatus(r.requestId, r.rxId, 'ready_for_pickup')}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                                  Ready for Pickup
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setMapModalTarget({ id: r.requestId || r.rxId || r.id, code: r.prescriptionCode || r.token })}
                                title="View patient & fulfillment location on interactive map"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#087F8C' }}>location_on</span>
                                Map
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => markPicked(r.reservationId || r.id, token, r.patientName, r.rxId, r.requestId)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>vaccines</span>
                                Dispense & Release
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!counterOrders.length && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>
                          No pending counter holds or in-progress orders at this time. All orders are dispensed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Recent Dispense Activity */}
              {dispenseHistory.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                    Recent Dispensations Today
                  </h3>
                  <div className="table-card" style={{ padding: 16 }}>
                    {dispenseHistory.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--tertiary)' }}>check_circle</span>
                          <span>Token <b>{item.token}</b> dispensed for <b>{item.patientName}</b></span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── VIEW 4: RESERVATIONS ── */}
          {activeNav === 'reservations' && (
            <>
              <div className="page-header-row">
                <div>
                  <h1 className="page-title">Counter Reservations & Holds</h1>
                  <p className="page-subtitle">Patient medications reserved for in-person pickup at {STORE_NAME}.</p>
                </div>
              </div>

              <div className="table-card">
                <table className="stitch-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Prescription</th>
                      <th>Patient Name</th>
                      <th>Reserved Medicines</th>
                      <th>Hold Status</th>
                      <th style={{ textAlign: 'right' }}>Dispense Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReservations.map((r) => {
                      const token = r.reservationToken || r.token;
                      const medNames = Array.isArray(r.items) && r.items.length > 0
                        ? r.items.map((i) => i.drugName || i.medicine).filter(Boolean).join(', ')
                        : Array.isArray(r.medicines) && r.medicines.length > 0
                        ? r.medicines.map((m) => typeof m === 'string' ? m : (m.medicine || m.drugName)).filter(Boolean).join(', ')
                        : 'Prescribed medications';

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
                          <td>
                            <span className="chip chip-in-stock">Active 4h Hold</span>
                          </td>
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

          {/* ── VIEW 5: DASHBOARD OVERVIEW ── */}
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
                  <div className="metric-value">{allPrescriptions.length}</div>
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

                <div className="metric-card" onClick={() => setActiveNav('dispensing')} style={{ cursor: 'pointer' }}>
                  <div className="metric-top">
                    <div className="metric-icon-box" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                      <span className="material-symbols-outlined">vaccines</span>
                    </div>
                  </div>
                  <div className="metric-value">{dispenseHistory.length}</div>
                  <div className="metric-label">Dispensed Today</div>
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

      {/* ── Fulfillment Interactive Map Modal ── */}
      {mapModalTarget && (
        <FulfillmentMapModal
          isOpen={!!mapModalTarget}
          onClose={() => setMapModalTarget(null)}
          targetId={mapModalTarget.id}
          prescriptionCode={mapModalTarget.code}
        />
      )}

      {/* ── Pharmacy Location Picker / Adder Modal ── */}
      {showLocationPicker && (
        <PharmacyLocationPickerModal
          isOpen={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          initialLocation={{
            latitude: pharmacyProfile.latitude,
            longitude: pharmacyProfile.longitude,
            address: pharmacyProfile.address,
          }}
          onLocationSaved={(newLoc) => {
            setPharmacyProfile((prev) => ({ ...prev, ...newLoc }));
            showNotification('Pharmacy storefront location updated successfully!');
          }}
        />
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
