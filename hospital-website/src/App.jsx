import { useState, useEffect, useMemo } from 'react';
import { api, usePoll } from './api.js';
import HospitalLocationPickerModal from './components/HospitalLocationPickerModal.jsx';

const URGENCY = {
  emergency: { chip: 'chip-red', label: 'Emergency Trauma' },
  high: { chip: 'chip-red', label: 'Emergency Trauma' },
  priority: { chip: 'chip-amber', label: 'Priority Referral' },
  medium: { chip: 'chip-amber', label: 'Priority Referral' },
  routine: { chip: 'chip-teal', label: 'Routine Triage' },
};

const DEFAULT_BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'];

export default function App({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState('dashboard'); // 'dashboard', 'referrals', 'beds', 'emergency', 'departments', 'profile'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toastMsg, setToastMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [referralFilter, setReferralFilter] = useState('all'); // 'all', 'pending', 'accepted', 'emergency', 'rejected'
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState({ latitude: null, longitude: null, address: '' });

  // Modal States
  const [showAddAmbulanceModal, setShowAddAmbulanceModal] = useState(false);
  const [showEditAmbulanceModal, setShowEditAmbulanceModal] = useState(null); // ambulance object
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedAmbulanceForDispatch, setSelectedAmbulanceForDispatch] = useState('');
  const [showAcceptReferralModal, setShowAcceptReferralModal] = useState(null); // referral object

  // Form States
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');

  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editVehicleNumber, setEditVehicleNumber] = useState('');

  const [dispatchPatientName, setDispatchPatientName] = useState('');
  const [dispatchPickup, setDispatchPickup] = useState('');
  const [dispatchUrgency, setDispatchUrgency] = useState('emergency');
  const [dispatchNotes, setDispatchNotes] = useState('');

  const [assignedBedInput, setAssignedBedInput] = useState('');
  const [assignedDeptInput, setAssignedDeptInput] = useState('');
  const [referralResponseNotes, setReferralResponseNotes] = useState('');

  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDiagnosticName, setNewDiagnosticName] = useState('');

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    type: '',
    address: '',
    phone: '',
    emergencyHelpline: '',
    nodalOfficer: '',
    operatingHours: '',
    acceptingEmergency: true,
  });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Poll backend for real operational data
  const hospitals = usePoll(() => api.get('/hospitals'), 5000);
  const referrals = usePoll(() => api.get('/referrals'), 3500);
  const ambulances = usePoll(() => api.get('/ambulances'), 4500);

  // Authenticated hospital record from MongoDB
  const hospital = useMemo(() => {
    const list = hospitals.data || [];
    if (!list.length) return null;
    return list.find((h) => h.id === user?.hospitalId) || list[0];
  }, [hospitals.data, user?.hospitalId]);

  // Sync profile form when hospital loads
  useEffect(() => {
    if (hospital) {
      setHospitalLocation({
        latitude: hospital.latitude ?? null,
        longitude: hospital.longitude ?? null,
        address: hospital.address || '',
      });
      setProfileForm({
        name: hospital.name || '',
        type: hospital.type || 'Community Health Center (CHC)',
        address: hospital.address || '',
        phone: hospital.phone || '',
        emergencyHelpline: hospital.emergencyHelpline || hospital.phone || '108',
        nodalOfficer: hospital.nodalOfficer || '',
        operatingHours: hospital.operatingHours || '24x7 Emergency & Inpatient Services',
        acceptingEmergency: hospital.acceptingEmergency !== false,
      });
    }
  }, [hospital]);

  const referralList = referrals.data || [];
  const pendingReferrals = referralList.filter((r) => r.status === 'pending');
  const acceptedReferrals = referralList.filter((r) => r.status === 'accepted');

  // Filter fleet vehicles for this hospital
  const ambulanceList = useMemo(() => {
    const all = ambulances.data || [];
    if (!hospital) return all;
    return all.filter((a) => !a.hospitalId || a.hospitalId === hospital.id);
  }, [ambulances.data, hospital]);

  const availableAmbulances = ambulanceList.filter((a) => a.status === 'available');
  const dispatchedAmbulances = ambulanceList.filter((a) =>
    ['dispatched', 'en_route', 'arrived', 'transporting', 'at_hospital'].includes(a.status)
  );

  // ── Adjust Bed Capacity (Persists to MongoDB) ──────────────────────────────
  const handleAdjustBed = async (type, delta) => {
    if (!hospital) return;
    const current = hospital.beds?.[type] ?? 0;
    const nextVal = Math.max(0, current + delta);
    const updatedBeds = { ...(hospital.beds || {}), [type]: nextVal };
    try {
      await api.patch(`/hospitals/${hospital.id}`, { beds: updatedBeds });
      showToast(`Updated ${type.toUpperCase()} beds: ${nextVal} available`);
      hospitals.reload?.();
    } catch (err) {
      showToast(`Error updating bed capacity: ${err.message || 'Failed'}`);
    }
  };

  // Set Exact Bed Capacity
  const handleSetExactBed = async (type, val) => {
    if (!hospital) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    const updatedBeds = { ...(hospital.beds || {}), [type]: num };
    try {
      await api.patch(`/hospitals/${hospital.id}`, { beds: updatedBeds });
      showToast(`Set ${type.toUpperCase()} capacity to ${num} beds`);
      hospitals.reload?.();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to update'}`);
    }
  };

  // ── Adjust Blood Bank Reserves (Persists to MongoDB) ────────────────────────
  const handleAdjustBlood = async (group, delta) => {
    if (!hospital) return;
    const current = hospital.blood?.[group] ?? 0;
    const nextVal = Math.max(0, current + delta);
    const updatedBlood = { ...(hospital.blood || {}), [group]: nextVal };
    try {
      await api.patch(`/hospitals/${hospital.id}`, { blood: updatedBlood });
      showToast(`Updated ${group} stock: ${nextVal} units in blood bank`);
      hospitals.reload?.();
    } catch (err) {
      showToast(`Blood bank update error: ${err.message || 'Failed'}`);
    }
  };

  // ── Add/Remove Diagnostics (Persists to MongoDB) ───────────────────────────
  const handleAddDiagnostic = async () => {
    if (!newDiagnosticName.trim() || !hospital) return;
    const name = newDiagnosticName.trim();
    const existing = hospital.diagnostics || [];
    if (existing.includes(name)) {
      showToast('Diagnostic service already listed.');
      return;
    }
    const updated = [...existing, name];
    try {
      await api.patch(`/hospitals/${hospital.id}`, { diagnostics: updated });
      setNewDiagnosticName('');
      showToast(`Added diagnostic: ${name}`);
      hospitals.reload?.();
    } catch (err) {
      showToast(`Error adding diagnostic: ${err.message}`);
    }
  };

  const handleRemoveDiagnostic = async (name) => {
    if (!hospital) return;
    const updated = (hospital.diagnostics || []).filter((d) => d !== name);
    try {
      await api.patch(`/hospitals/${hospital.id}`, { diagnostics: updated });
      showToast(`Removed diagnostic: ${name}`);
      hospitals.reload?.();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // ── Add/Remove Clinical Departments (Persists to MongoDB) ─────────────────
  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim() || !hospital) return;
    const name = newDepartmentName.trim();
    const existing = hospital.departments || [];
    if (existing.includes(name)) {
      showToast('Department already listed.');
      return;
    }
    const updated = [...existing, name];
    try {
      await api.patch(`/hospitals/${hospital.id}`, { departments: updated });
      setNewDepartmentName('');
      showToast(`Added department: ${name}`);
      hospitals.reload?.();
    } catch (err) {
      showToast(`Error adding department: ${err.message}`);
    }
  };

  const handleRemoveDepartment = async (name) => {
    if (!hospital) return;
    const updated = (hospital.departments || []).filter((d) => d !== name);
    try {
      await api.patch(`/hospitals/${hospital.id}`, { departments: updated });
      showToast(`Removed department: ${name}`);
      hospitals.reload?.();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // ── Save Hospital Profile Changes (Persists to MongoDB) ───────────────────
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!hospital) return;
    try {
      await api.patch(`/hospitals/${hospital.id}`, {
        name: profileForm.name.trim(),
        type: profileForm.type.trim(),
        address: profileForm.address.trim(),
        phone: profileForm.phone.trim(),
        emergencyHelpline: profileForm.emergencyHelpline.trim(),
        nodalOfficer: profileForm.nodalOfficer.trim(),
        operatingHours: profileForm.operatingHours.trim(),
        acceptingEmergency: profileForm.acceptingEmergency,
      });
      showToast('Hospital profile updated successfully in database.');
      hospitals.reload?.();
    } catch (err) {
      showToast(`Failed to update profile: ${err.message || 'Error'}`);
    }
  };

  // ── Toggle Emergency Acceptance Status (Instant Persistence) ─────────────
  const handleToggleEmergencyAcceptance = async () => {
    if (!hospital) return;
    const nextVal = !profileForm.acceptingEmergency;
    setProfileForm((prev) => ({ ...prev, acceptingEmergency: nextVal }));
    try {
      await api.patch(`/hospitals/${hospital.id}`, { acceptingEmergency: nextVal });
      showToast(
        nextVal
          ? '🟢 24×7 Emergency Care Active: Now accepting trauma & emergency cases'
          : '🔴 Emergency Divert Active: Facility marked at emergency capacity'
      );
      hospitals.reload?.();
    } catch (err) {
      setProfileForm((prev) => ({ ...prev, acceptingEmergency: !nextVal }));
      showToast(`Error updating emergency status: ${err.message}`);
    }
  };

  // ── Fleet: Register New Vehicle (Persists to MongoDB) ──────────────────────
  const handleAddAmbulance = async (e) => {
    e.preventDefault();
    if (!newVehicleNumber.trim()) {
      showToast('Vehicle registration number is required.');
      return;
    }
    try {
      await api.post('/ambulances', {
        vehicle: newVehicleNumber.trim().toUpperCase(),
        driver: newDriverName.trim() || 'Assigned Driver',
        driverPhone: newDriverPhone.trim() || '+91 90000 00000',
        hospitalId: hospital?.id,
      });
      showToast(`Registered ambulance ${newVehicleNumber.toUpperCase()} to fleet`);
      setShowAddAmbulanceModal(false);
      setNewVehicleNumber('');
      setNewDriverName('');
      setNewDriverPhone('');
      ambulances.reload?.();
    } catch (err) {
      showToast(`Registration error: ${err.message || 'Failed'}`);
    }
  };

  // ── Fleet: Edit Vehicle (Persists to MongoDB) ──────────────────────────────
  const handleEditAmbulanceSubmit = async (e) => {
    e.preventDefault();
    if (!showEditAmbulanceModal) return;
    try {
      await api.put(`/ambulances/${showEditAmbulanceModal.id}`, {
        vehicle: editVehicleNumber.trim().toUpperCase(),
        driver: editDriverName.trim(),
        driverPhone: editDriverPhone.trim(),
      });
      showToast(`Updated details for ambulance ${editVehicleNumber.toUpperCase()}`);
      setShowEditAmbulanceModal(null);
      ambulances.reload?.();
    } catch (err) {
      showToast(`Update error: ${err.message || 'Failed'}`);
    }
  };

  // ── Fleet: Remove Vehicle (Persists to MongoDB) ────────────────────────────
  const handleDeleteAmbulance = async (id, vehicle) => {
    if (!window.confirm(`Are you sure you want to decommission vehicle ${vehicle} from the active fleet?`)) return;
    try {
      await api.delete(`/ambulances/${id}`);
      showToast(`Decommissioned vehicle ${vehicle} from fleet`);
      ambulances.reload?.();
    } catch (err) {
      showToast(`Error: ${err.message || 'Failed to remove'}`);
    }
  };

  // ── Fleet: Update Vehicle Status (Persists to MongoDB) ────────────────────
  const handleUpdateAmbulanceStatus = async (id, vehicle, newStatus) => {
    try {
      await api.patch(`/ambulances/${id}`, { status: newStatus });
      showToast(`Ambulance ${vehicle} status updated to: ${newStatus.toUpperCase()}`);
      ambulances.reload?.();
    } catch (err) {
      showToast(`Status update failed: ${err.message || 'Invalid transition'}`);
    }
  };

  // ── Fleet: Structured Emergency 108 Dispatch ─────────────────────────────
  const handleEmergencyDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchPickup.trim()) {
      showToast('Emergency pickup location is required.');
      return;
    }
    try {
      const res = await api.post('/ambulances/request', {
        hospitalId: hospital?.id,
        ambulanceId: selectedAmbulanceForDispatch || undefined,
        patientName: dispatchPatientName.trim() || 'Emergency Patient',
        pickup: dispatchPickup.trim(),
        urgency: dispatchUrgency,
        notes: dispatchNotes.trim(),
        eta: '10-15 mins',
      });
      showToast(`🚨 108 Ambulance ${res?.vehicle || ''} dispatched to ${dispatchPickup}!`);
      setShowDispatchModal(false);
      setDispatchPatientName('');
      setDispatchPickup('');
      setDispatchNotes('');
      setSelectedAmbulanceForDispatch('');
      ambulances.reload?.();
    } catch (err) {
      showToast(`Dispatch failed: ${err.message || 'No available vehicle'}`);
    }
  };

  // ── Referrals: Accept Referral with Bed & Department ─────────────────────
  const handleConfirmAcceptReferral = async (e) => {
    e.preventDefault();
    if (!showAcceptReferralModal || !hospital) return;
    const ref = showAcceptReferralModal;
    const assignedBed = assignedBedInput.trim() || 'General Ward (Allocated)';
    const assignedDept = assignedDeptInput.trim() || ref.specialty || 'General Medicine';

    try {
      await api.patch(`/referrals/${ref.id}`, {
        status: 'accepted',
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        assignedBed,
        assignedDepartment: assignedDept,
        notes: referralResponseNotes.trim() || 'Referral accepted. Ward admission prepared.',
      });
      showToast(`Referral Accepted for ${ref.patientName} — Assigned: ${assignedBed}`);
      setShowAcceptReferralModal(null);
      setAssignedBedInput('');
      setAssignedDeptInput('');
      setReferralResponseNotes('');
      referrals.reload?.();
      hospitals.reload?.();
    } catch (err) {
      showToast(`Notice: ${err.message || 'Failed to accept referral'}`);
    }
  };

  // Referrals: Decline Referral
  const handleDeclineReferral = async (id, patientName) => {
    if (!window.confirm(`Decline and reroute referral for ${patientName}?`)) return;
    try {
      await api.patch(`/referrals/${id}`, {
        status: 'rejected',
        notes: 'Hospital bed capacity constraint. Rerouted to district command center.',
      });
      showToast(`Referral declined for ${patientName} — Rerouted back to network`);
      referrals.reload?.();
      hospitals.reload?.();
    } catch (err) {
      showToast(`Notice: ${err.message || 'Failed to decline referral'}`);
    }
  };

  const handleShowNotifications = async () => {
    try {
      const notifs = await api.get('/notifications');
      if (!notifs || notifs.length === 0) {
        showToast('No new notifications');
      } else {
        const top = notifs[0];
        showToast(`Alert: ${top.title} - ${top.message}`);
      }
    } catch {
      showToast('Notifications checked.');
    }
  };

  // Filtered Referrals
  const filteredReferrals = useMemo(() => {
    return referralList.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        (r.patientName && r.patientName.toLowerCase().includes(q)) ||
        (r.referringDoctor && r.referringDoctor.toLowerCase().includes(q)) ||
        (r.specialty && r.specialty.toLowerCase().includes(q)) ||
        (r.assignedBed && r.assignedBed.toLowerCase().includes(q));
      if (!matchSearch) return false;
      if (referralFilter === 'pending') return r.status === 'pending';
      if (referralFilter === 'accepted') return r.status === 'accepted';
      if (referralFilter === 'rejected') return r.status === 'rejected';
      if (referralFilter === 'emergency') return r.urgency === 'emergency' || r.urgency === 'high';
      return true;
    });
  }, [referralList, searchQuery, referralFilter]);

  // Loading State
  if (hospitals.loading && !hospital) {
    return (
      <div className="login-shell">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--primary)', animation: 'spin 1s linear infinite' }}>
            progress_activity
          </span>
          <p className="login-subtitle">Connecting to RuralCare Hospital Network…</p>
        </div>
      </div>
    );
  }

  // Error State if no hospital record exists
  if (!hospitals.loading && !hospital) {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--emergency-red)' }}>warning</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '10px 0 6px' }}>Hospital Record Not Found</h2>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 16 }}>
            No registered hospital record linked to account {user?.email}. Please contact the system administrator.
          </p>
          <button className="btn btn-outline" onClick={onLogout}>Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="hospital-shell">
      {/* ── Top Header Navigation ── */}
      <header className="top-header-bar">
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

          {/* Hospital Brand with Clickable Location */}
          <div className="navbar-hospital-brand">
            <div className="hospital-logo">
              <span className="material-symbols-outlined fill" style={{ fontSize: 20 }}>local_hospital</span>
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="navbar-hospital-name" title={hospital.name}>
                {hospital.name}
              </div>
              <button
                type="button"
                className="navbar-hospital-location-btn"
                onClick={() => setShowLocationPicker(true)}
                title="Click to view and update hospital location on interactive map"
              >
                <span className="material-symbols-outlined fill" style={{ fontSize: 13, color: 'var(--primary)' }}>location_on</span>
                <span className="navbar-hospital-location-text">
                  {hospitalLocation.address ? hospitalLocation.address.split(',').slice(0, 2).join(', ') : (hospital.address ? hospital.address.split(',').slice(0, 2).join(', ') : 'Set Hospital Location')}
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
              placeholder="Search referrals, patients, bed wards, ambulances..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ── Header Right: Notifications & Staff Avatar ── */}
        <div className="header-right">
          <button className="icon-btn" title="Notifications" onClick={handleShowNotifications}>
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="icon-btn" title="Hospital Profile & Settings" onClick={() => setActiveNav('profile')}>
            <span className="material-symbols-outlined">settings</span>
          </button>

          <div className="admin-avatar" title={user?.name || hospital.name}>
            {(user?.name || hospital.name || 'RC').slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── App Body: Sidebar + Main Content ── */}
      <div className="app-body">
        {/* ── Side Navigation ── */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-action-wrap">
            <button
              className="sidebar-btn"
              onClick={() => {
                setActiveNav('referrals');
                showToast('Viewing incoming patient referrals queue');
              }}
            >
              <span className="material-symbols-outlined fill">add</span>
              Review Referrals
            </button>
          </div>

          <nav className="sidebar-nav-list">
            <button
              className={`sidebar-nav-btn ${activeNav === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveNav('dashboard')}
            >
              <span className="material-symbols-outlined" data-weight={activeNav === 'dashboard' ? 'fill' : 'normal'}>
                dashboard
              </span>
              <span>Dashboard</span>
            </button>

            <button
              className={`sidebar-nav-btn ${activeNav === 'referrals' ? 'active' : ''}`}
              onClick={() => setActiveNav('referrals')}
            >
              <span className="material-symbols-outlined">clinical_notes</span>
              <span>Referrals</span>
              {pendingReferrals.length > 0 && (
                <span className="sidebar-badge alert">{pendingReferrals.length}</span>
              )}
            </button>

            <button
              className={`sidebar-nav-btn ${activeNav === 'beds' ? 'active' : ''}`}
              onClick={() => setActiveNav('beds')}
            >
              <span className="material-symbols-outlined">bed</span>
              <span>Beds & Resources</span>
            </button>

            <button
              className={`sidebar-nav-btn ${activeNav === 'emergency' ? 'active' : ''}`}
              onClick={() => setActiveNav('emergency')}
            >
              <span className="material-symbols-outlined">emergency</span>
              <span>Emergency & Fleet</span>
              {dispatchedAmbulances.length > 0 && (
                <span className="sidebar-badge">{dispatchedAmbulances.length} Active</span>
              )}
            </button>

            <button
              className={`sidebar-nav-btn ${activeNav === 'departments' ? 'active' : ''}`}
              onClick={() => setActiveNav('departments')}
            >
              <span className="material-symbols-outlined">account_tree</span>
              <span>Departments</span>
            </button>

            <button
              className={`sidebar-nav-btn ${activeNav === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveNav('profile')}
            >
              <span className="material-symbols-outlined">domain</span>
              <span>Hospital Profile</span>
            </button>
          </nav>

          <div className="sidebar-footer-box">
            <div style={{ padding: '4px 2px 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Signed in as {user?.name || user?.email}
            </div>
            <button className="sidebar-signout-btn" onClick={onLogout}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Canvas Body ── */}
        <main className="canvas-body">
          {/* ══════════════════════════════════════════════════════════════════
              VIEW 1: DASHBOARD OVERVIEW
             ══════════════════════════════════════════════════════════════════ */}
          {activeNav === 'dashboard' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">
                    Welcome, {user?.name || hospital.name}
                  </h1>
                  <p className="page-subtitle">
                    Live operational dashboard for {hospital.name} ({hospital.type || 'Hospital'}).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${profileForm.acceptingEmergency ? 'btn-primary' : 'btn-danger'}`}
                    onClick={handleToggleEmergencyAcceptance}
                    title="Click to toggle emergency trauma reception status"
                  >
                    <span className="material-symbols-outlined fill" style={{ fontSize: 16 }}>
                      {profileForm.acceptingEmergency ? 'check_circle' : 'do_not_disturb'}
                    </span>
                    {profileForm.acceptingEmergency ? '24×7 Emergency Active' : 'Emergency Divert'}
                  </button>
                </div>
              </div>

              {/* Bento KPI Summary Grid */}
              <div className="kpi-bento-grid">
                <div className="kpi-card" onClick={() => setActiveNav('referrals')} style={{ cursor: 'pointer' }}>
                  <div className="kpi-card-head">
                    <span className="kpi-title">Incoming Referrals</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">clinical_notes</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{referralList.length}</div>
                    <div className="kpi-footer-sub">
                      <span style={{ color: pendingReferrals.length > 0 ? 'var(--warning-amber)' : 'inherit', fontWeight: 700 }}>
                        {pendingReferrals.length} awaiting response
                      </span>
                    </div>
                  </div>
                </div>

                <div className="kpi-card" onClick={() => setActiveNav('beds')} style={{ cursor: 'pointer' }}>
                  <div className="kpi-card-head">
                    <span className="kpi-title">General Available Beds</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">bed</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{hospital.beds?.general ?? 0}</div>
                    <div className="kpi-footer-sub">
                      Total Capacity: {hospital.totalBeds?.general ?? 20} Beds
                    </div>
                  </div>
                </div>

                <div className="kpi-card" onClick={() => setActiveNav('beds')} style={{ cursor: 'pointer' }}>
                  <div className="kpi-card-head">
                    <span className="kpi-title">ICU & Critical Care</span>
                    <div className={`kpi-icon-wrap ${(hospital.beds?.icu ?? 0) <= 2 ? 'alert' : ''}`}>
                      <span className="material-symbols-outlined">vital_signs</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value" style={{ color: (hospital.beds?.icu ?? 0) <= 2 ? 'var(--emergency-red)' : 'var(--on-surface)' }}>
                      {hospital.beds?.icu ?? 0}
                    </div>
                    <div className="kpi-footer-sub">
                      {(hospital.beds?.icu ?? 0) <= 2 ? (
                        <span style={{ color: 'var(--emergency-red)', fontWeight: 700 }}>Critical Capacity</span>
                      ) : (
                        `Total Capacity: ${hospital.totalBeds?.icu ?? 5} Beds`
                      )}
                    </div>
                  </div>
                </div>

                <div className="kpi-card" onClick={() => setActiveNav('beds')} style={{ cursor: 'pointer' }}>
                  <div className="kpi-card-head">
                    <span className="kpi-title">Emergency Trauma Beds</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">emergency</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{hospital.beds?.emergency ?? 0}</div>
                    <div className="kpi-footer-sub">
                      Total Capacity: {hospital.totalBeds?.emergency ?? 10} Beds
                    </div>
                  </div>
                </div>

                <div className="kpi-card" onClick={() => setActiveNav('emergency')} style={{ cursor: 'pointer' }}>
                  <div className="kpi-card-head">
                    <span className="kpi-title">108 Fleet Vehicles</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">airport_shuttle</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{availableAmbulances.length} Ready</div>
                    <div className="kpi-footer-sub">
                      {dispatchedAmbulances.length} in transit · {ambulanceList.length} total
                    </div>
                  </div>
                </div>

                <div className="kpi-card" onClick={() => setActiveNav('referrals')} style={{ cursor: 'pointer' }}>
                  <div className="kpi-card-head">
                    <span className="kpi-title">Admitted / Reserved</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">check_circle</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{acceptedReferrals.length}</div>
                    <div className="kpi-footer-sub">Confirmed admissions</div>
                  </div>
                </div>
              </div>

              {/* Ward Capacity Meters with Stepper Controls */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Live Ward Bed Allocation</h3>
                  <button className="btn btn-outline btn-sm" onClick={() => setActiveNav('beds')}>
                    Manage All Beds →
                  </button>
                </div>

                <div className="bed-meter-grid">
                  {[
                    { key: 'general', title: 'General Medical Ward', chip: 'chip-green' },
                    { key: 'icu', title: 'ICU & Critical Care', chip: (hospital.beds?.icu ?? 0) <= 2 ? 'chip-red' : 'chip-green' },
                    { key: 'emergency', title: 'Emergency Trauma Bay', chip: 'chip-teal' },
                    { key: 'ventilator', title: 'Ventilator / Life Support', chip: 'chip-amber' },
                  ].map((ward) => {
                    const avail = hospital.beds?.[ward.key] ?? 0;
                    const total = hospital.totalBeds?.[ward.key] ?? Math.max(avail, 10);
                    const pct = total > 0 ? Math.min(100, Math.round((avail / total) * 100)) : 50;

                    return (
                      <div className="bed-box" key={ward.key}>
                        <div className="bed-box-title-row">
                          <span className="bed-box-name">{ward.title}</span>
                          <span className={`chip ${ward.chip}`}>{avail > 0 ? 'Available' : 'Full'}</span>
                        </div>
                        <div className="bed-box-val">{avail} Beds Available</div>
                        <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                          Total Ward Capacity: <b>{total}</b> beds ({pct}% available)
                        </div>
                        <div className="progress-track">
                          <div
                            className={`progress-fill-green ${avail <= 2 ? 'alert' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="stepper-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleAdjustBed(ward.key, -1)}
                            disabled={avail <= 0}
                          >
                            − Occupy
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAdjustBed(ward.key, 1)}
                          >
                            + Release
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Required Incoming Referrals */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Incoming Referrals (Action Required)</h3>
                  <button className="btn btn-outline btn-sm" onClick={() => setActiveNav('referrals')}>
                    View Full Inbox ({pendingReferrals.length})
                  </button>
                </div>

                <div className="stitch-table-card">
                  <table className="stitch-table">
                    <thead>
                      <tr>
                        <th>Patient Name</th>
                        <th>Referring Doctor</th>
                        <th>Department</th>
                        <th>Triage Urgency</th>
                        <th style={{ textAlign: 'right' }}>Review Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReferrals.slice(0, 4).map((ref) => {
                        const ug = URGENCY[ref.urgency] || URGENCY.routine;
                        return (
                          <tr key={ref.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--on-surface)' }}>{ref.patientName || 'Patient'}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>ID: {ref.id}</div>
                            </td>
                            <td>{ref.referringDoctor || 'Medical Officer'}</td>
                            <td>
                              <span className="chip chip-teal">{ref.specialty || 'General Medicine'}</span>
                            </td>
                            <td>
                              <span className={`chip ${ug.chip}`}>{ug.label}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setShowAcceptReferralModal(ref);
                                  setAssignedBedInput('');
                                  setAssignedDeptInput(ref.specialty || 'General Medicine');
                                }}
                              >
                                Review & Assign Bed
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!pendingReferrals.length && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>
                            No pending triage referrals in the queue.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 2: REFERRALS TRIAGE INBOX
             ══════════════════════════════════════════════════════════════════ */}
          {activeNav === 'referrals' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Referral Triage Inbox</h1>
                  <p className="page-subtitle">Incoming patient referrals from rural PHCs and teleconsultations.</p>
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className={`btn btn-sm ${referralFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setReferralFilter('all')}
                  >
                    All ({referralList.length})
                  </button>
                  <button
                    className={`btn btn-sm ${referralFilter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setReferralFilter('pending')}
                  >
                    Pending ({pendingReferrals.length})
                  </button>
                  <button
                    className={`btn btn-sm ${referralFilter === 'accepted' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setReferralFilter('accepted')}
                  >
                    Accepted ({acceptedReferrals.length})
                  </button>
                  <button
                    className={`btn btn-sm ${referralFilter === 'emergency' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setReferralFilter('emergency')}
                  >
                    Emergency Trauma
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Search patient, doctor, ward..."
                  style={{
                    height: 38,
                    padding: '0 14px',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    background: '#fff',
                    outline: 'none',
                    width: 260,
                  }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="referral-grid">
                {filteredReferrals.map((ref) => {
                  const ug = URGENCY[ref.urgency] || URGENCY.routine;
                  const isPending = ref.status === 'pending';
                  const isAccepted = ref.status === 'accepted';
                  const isDeclined = ref.status === 'rejected';

                  return (
                    <div className="referral-item-card" key={ref.id}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div className="patient-name-title">{ref.patientName || 'Patient'}</div>
                            <div className="doctor-origin-sub">
                              Dr. {ref.referringDoctor || 'Medical Officer'} · {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString() : 'Recent'}
                            </div>
                          </div>
                          <span className={`chip ${isPending ? 'chip-amber' : isAccepted ? 'chip-green' : 'chip-red'}`}>
                            {isPending ? 'Pending Action' : isAccepted ? 'Accepted' : 'Declined'}
                          </span>
                        </div>

                        <div className="referral-tags-row">
                          <span className="chip chip-teal">{ref.specialty || 'General Medicine'}</span>
                          <span className={`chip ${ug.chip}`}>{ug.label}</span>
                          {ref.beds && (
                            <span className="chip" style={{ background: 'var(--surface-dim)', color: 'var(--on-surface-variant)' }}>
                              Bed Type: {ref.beds}
                            </span>
                          )}
                        </div>

                        {ref.reason && (
                          <div style={{ fontSize: 12.5, color: 'var(--on-surface)', margin: '6px 0' }}>
                            <b>Clinical Reason:</b> {ref.reason}
                          </div>
                        )}

                        {ref.diagnostics && ref.diagnostics.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                            Required Diagnostics: <b>{ref.diagnostics.join(', ')}</b>
                          </div>
                        )}

                        {ref.notes && (
                          <div className="clinical-notes-box">
                            <b>Notes:</b> {ref.notes}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 12 }}>
                        {isPending ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setShowAcceptReferralModal(ref);
                                setAssignedBedInput('');
                                setAssignedDeptInput(ref.specialty || 'General Medicine');
                              }}
                            >
                              Accept & Assign Bed
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeclineReferral(ref.id, ref.patientName)}
                            >
                              Decline
                            </button>
                          </div>
                        ) : isAccepted ? (
                          <div style={{ padding: '8px 12px', background: 'var(--success-soft)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, color: 'var(--success-text)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Bed Reserved & Confirmed</span>
                            <span>{ref.assignedBed || 'Bed Allocated'}</span>
                          </div>
                        ) : (
                          <div style={{ padding: '8px 12px', background: 'var(--emergency-soft)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--emergency-red)' }}>
                            Rerouted back to District Network
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!filteredReferrals.length && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--outline-variant)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 42, color: 'var(--on-surface-variant)' }}>inbox</span>
                    <p style={{ marginTop: 8, color: 'var(--on-surface-variant)', fontSize: 13.5 }}>
                      No referrals found matching the selected filter.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 3: BEDS & RESOURCES MANAGEMENT
             ══════════════════════════════════════════════════════════════════ */}
          {activeNav === 'beds' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Beds & Resource Management</h1>
                  <p className="page-subtitle">Real-time bed allocation, blood bank reserves, and verified diagnostics.</p>
                </div>
              </div>

              {/* Ward Stepper Grid */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Ward Bed Capacity (Live Allocation)</h3>
                  <span className="chip chip-green">Synchronized with MongoDB</span>
                </div>

                <div className="bed-meter-grid">
                  {[
                    { key: 'general', title: 'General Medical Ward' },
                    { key: 'icu', title: 'ICU & Critical Care' },
                    { key: 'emergency', title: 'Emergency Trauma Bay' },
                    { key: 'ventilator', title: 'Ventilator / Life Support' },
                  ].map((ward) => {
                    const avail = hospital.beds?.[ward.key] ?? 0;
                    const total = hospital.totalBeds?.[ward.key] ?? Math.max(avail, 10);
                    return (
                      <div className="bed-box" key={ward.key}>
                        <span className="bed-box-name">{ward.title}</span>
                        <div className="bed-box-val" style={{ color: avail <= 2 ? 'var(--emergency-red)' : 'var(--primary)' }}>
                          {avail} Available
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)', margin: '4px 0 10px' }}>
                          Total Ward Capacity: {total} Beds
                        </div>
                        <div className="stepper-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleAdjustBed(ward.key, -1)}
                            disabled={avail <= 0}
                          >
                            − Occupy Bed
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAdjustBed(ward.key, 1)}
                          >
                            + Release Bed
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blood Bank Matrix */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Blood Bank Reserve Units</h3>
                  <span className="chip chip-teal">Live Database Inventory</span>
                </div>

                <div className="blood-reserve-grid">
                  {DEFAULT_BLOOD_GROUPS.map((group) => {
                    const units = hospital.blood?.[group] ?? 0;
                    const isShort = units <= 2;
                    return (
                      <div key={group} className={`blood-card-cell ${isShort ? 'shortage' : ''}`}>
                        <div className="blood-group-label">{group}</div>
                        <div className="blood-units-number">{units}</div>
                        <div style={{ fontSize: 11, color: isShort ? 'var(--emergency-red)' : 'var(--on-surface-variant)', marginBottom: 8 }}>
                          {isShort ? 'Critical Shortage' : 'Units in Reserve'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 8px', fontSize: 13 }}
                            onClick={() => handleAdjustBlood(group, -1)}
                            disabled={units <= 0}
                            title="Decrement 1 unit"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ padding: '2px 8px', fontSize: 13 }}
                            onClick={() => handleAdjustBlood(group, 1)}
                            title="Add 1 unit"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Operational Diagnostics Manager */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Operational Diagnostics & Clinical Equipment</h3>
                  <span className="chip chip-green">Active In Database</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {(hospital.diagnostics || []).map((d) => (
                    <span key={d} className="chip chip-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span>{d}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDiagnostic(d)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}
                        title={`Remove ${d}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    </span>
                  ))}
                  {(!hospital.diagnostics || hospital.diagnostics.length === 0) && (
                    <span style={{ fontSize: 12.5, color: 'var(--on-surface-variant)' }}>
                      No diagnostic services currently registered.
                    </span>
                  )}
                </div>

                {/* Add Diagnostic Form */}
                <div style={{ display: 'flex', gap: 8, maxWidth: 460 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Digital X-Ray, CT Scan, Ultrasound, CBC..."
                    value={newDiagnosticName}
                    onChange={(e) => setNewDiagnosticName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDiagnostic(); }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleAddDiagnostic}>
                    + Add Diagnostic
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 4: EMERGENCY & 108 FLEET COMMAND
             ══════════════════════════════════════════════════════════════════ */}
          {activeNav === 'emergency' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Emergency & 108 Fleet Command</h1>
                  <p className="page-subtitle">Real-time ambulance dispatch, driver coordination, and vehicle availability.</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowAddAmbulanceModal(true)}
                  >
                    + Register Ambulance
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      const avail = availableAmbulances[0];
                      setSelectedAmbulanceForDispatch(avail ? avail.id : '');
                      setShowDispatchModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>
                      emergency
                    </span>
                    Dispatch 108 Emergency
                  </button>
                </div>
              </div>

              {/* Active Emergency Assignments Panel */}
              {dispatchedAmbulances.length > 0 && (
                <div className="panel-white-card" style={{ borderColor: 'var(--emergency-red)', borderLeftWidth: 4 }}>
                  <div className="panel-title-bar">
                    <h3 className="panel-heading" style={{ color: 'var(--emergency-red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined fill">emergency</span>
                      Active Emergency Dispatches ({dispatchedAmbulances.length})
                    </h3>
                    <span className="chip chip-red">Live En Route</span>
                  </div>

                  <div>
                    {dispatchedAmbulances.map((a) => (
                      <div className="fleet-row-item" key={a.id} style={{ background: '#fef2f2', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="fleet-vehicle-tag" style={{ background: 'var(--emergency-red)', color: '#fff' }}>{a.vehicle}</span>
                            <span className="chip chip-amber" style={{ textTransform: 'uppercase', fontSize: 10.5 }}>{a.status}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginTop: 4 }}>
                            Patient: {a.patientName || 'Emergency Patient'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                            Pickup Location: <b>{a.pickup || 'Emergency Site'}</b> {a.eta ? `· ETA: ${a.eta}` : ''}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                            Driver: <b>{a.driver}</b> · Phone: <a href={`tel:${a.driverPhone}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{a.driverPhone}</a>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleUpdateAmbulanceStatus(a.id, a.vehicle, 'available')}
                          >
                            Mark Returned / Standby
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Registered Fleet Vehicles */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Authorized Ambulance Fleet ({ambulanceList.length} Vehicles)</h3>
                  <span className="chip chip-green">MongoDB Backed</span>
                </div>

                <div>
                  {ambulanceList.map((a) => {
                    const isDisp = ['dispatched', 'en_route', 'arrived', 'transporting', 'at_hospital'].includes(a.status);
                    const isMaint = a.status === 'maintenance';

                    return (
                      <div className="fleet-row-item" key={a.id}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="fleet-vehicle-tag">{a.vehicle}</span>
                            <span className={`chip ${isDisp ? 'chip-red' : isMaint ? 'chip-amber' : 'chip-green'}`} style={{ textTransform: 'uppercase' }}>
                              {a.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                            Driver: <b>{a.driver || 'Assigned Driver'}</b> · Phone: <a href={`tel:${a.driverPhone}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{a.driverPhone || 'Not recorded'}</a>
                          </div>
                          {isDisp && a.pickup && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--emergency-red)', marginTop: 2 }}>
                              En route to {a.pickup} {a.patientName ? `(${a.patientName})` : ''}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {/* Quick Status Toggles */}
                          {isDisp ? (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleUpdateAmbulanceStatus(a.id, a.vehicle, 'available')}
                            >
                              Release to Standby
                            </button>
                          ) : isMaint ? (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleUpdateAmbulanceStatus(a.id, a.vehicle, 'available')}
                            >
                              Mark Operational
                            </button>
                          ) : (
                            <>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => handleUpdateAmbulanceStatus(a.id, a.vehicle, 'maintenance')}
                                title="Set maintenance mode"
                              >
                                Maintenance
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setSelectedAmbulanceForDispatch(a.id);
                                  setShowDispatchModal(true);
                                }}
                              >
                                Dispatch
                              </button>
                            </>
                          )}

                          {/* Edit Vehicle */}
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 32, height: 32 }}
                            title="Edit Vehicle & Driver"
                            onClick={() => {
                              setShowEditAmbulanceModal(a);
                              setEditVehicleNumber(a.vehicle);
                              setEditDriverName(a.driver || '');
                              setEditDriverPhone(a.driverPhone || '');
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>edit</span>
                          </button>

                          {/* Delete Vehicle */}
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 32, height: 32, color: 'var(--emergency-red)' }}
                            title="Decommission Vehicle"
                            onClick={() => handleDeleteAmbulance(a.id, a.vehicle)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {!ambulanceList.length && (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 36 }}>airport_shuttle</span>
                      <p style={{ marginTop: 8 }}>No ambulance vehicles currently registered for this hospital.</p>
                      <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => setShowAddAmbulanceModal(true)}>
                        + Register First Ambulance
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 5: CLINICAL DEPARTMENTS DIRECTORY
             ══════════════════════════════════════════════════════════════════ */}
          {activeNav === 'departments' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Hospital Department Directory</h1>
                  <p className="page-subtitle">Active clinical wings and specialty divisions at {hospital.name}.</p>
                </div>
              </div>

              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Active Clinical Departments ({(hospital.departments || []).length})</h3>
                  <span className="chip chip-green">Live in MongoDB</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {(hospital.departments || []).map((dept) => (
                    <div
                      key={dept}
                      style={{
                        padding: 18,
                        background: 'var(--background)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--outline-variant)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{dept}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                          Operational Clinical Division · 24×7 Emergency Integration
                        </div>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 28, height: 28, color: 'var(--emergency-red)' }}
                        onClick={() => handleRemoveDepartment(dept)}
                        title={`Remove ${dept} department`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                      </button>
                    </div>
                  ))}
                  {(!hospital.departments || hospital.departments.length === 0) && (
                    <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                      No clinical departments currently listed. Add a department below.
                    </div>
                  )}
                </div>

                {/* Add Department Form */}
                <div style={{ display: 'flex', gap: 10, maxWidth: 460 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="New department name (e.g. Orthopedics, Cardiology)..."
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDepartment(); }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleAddDepartment}>
                    + Add Department
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              VIEW 6: HOSPITAL PROFILE & OPERATIONAL SETTINGS
             ══════════════════════════════════════════════════════════════════ */}
          {activeNav === 'profile' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Hospital Profile & Operational Settings</h1>
                  <p className="page-subtitle">Configure hospital metadata, emergency hotlines, and public facility details.</p>
                </div>
              </div>

              <div className="panel-white-card">
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                        HOSPITAL NAME
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                        FACILITY TYPE
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={profileForm.type}
                        onChange={(e) => setProfileForm({ ...profileForm, type: e.target.value })}
                        placeholder="e.g. Community Health Center (CHC), District Hospital..."
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                        OFFICIAL CONTACT PHONE
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="+91 6112 223344"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                        24×7 EMERGENCY HELPLINE
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={profileForm.emergencyHelpline}
                        onChange={(e) => setProfileForm({ ...profileForm, emergencyHelpline: e.target.value })}
                        placeholder="108 or +91 9431 777701"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                        NODAL OFFICER / MEDICAL SUPERINTENDENT
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={profileForm.nodalOfficer}
                        onChange={(e) => setProfileForm({ ...profileForm, nodalOfficer: e.target.value })}
                        placeholder="Dr. Rajesh Sinha (CMO)"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                        OPERATING HOURS
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={profileForm.operatingHours}
                        onChange={(e) => setProfileForm({ ...profileForm, operatingHours: e.target.value })}
                        placeholder="24x7 Emergency & Inpatient Services"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--on-surface-variant)' }}>
                      FULL PHYSICAL ADDRESS
                    </label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      placeholder="Street, Town, District, State, Pincode"
                    />
                  </div>

                  {/* Interactive Map Coordinates Action */}
                  <div style={{ padding: 14, background: 'var(--surface-dim)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--on-surface)' }}>Map Coordinates & Geolocation</div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                        {hospitalLocation.latitude && hospitalLocation.longitude
                          ? `Latitude: ${hospitalLocation.latitude.toFixed(6)}, Longitude: ${hospitalLocation.longitude.toFixed(6)}`
                          : 'Coordinates not set yet'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setShowLocationPicker(true)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 6 }}>location_on</span>
                      Update on Interactive Map
                    </button>
                  </div>

                  {/* Emergency Acceptance Live Switch */}
                  <div style={{ padding: 16, border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--on-surface)' }}>
                        Emergency Trauma Reception Status
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                        When active, patients and the AI assistant can see this facility as ready to receive emergency and 108 cases.
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`btn btn-sm ${profileForm.acceptingEmergency ? 'btn-primary' : 'btn-danger'}`}
                      onClick={handleToggleEmergencyAcceptance}
                    >
                      {profileForm.acceptingEmergency ? '🟢 Accepting Emergencies' : '🔴 Emergency Divert'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: '9px 24px' }}>
                      Save Profile Changes
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Toast Alert ── */}
      {toastMsg && (
        <div className="toast-container">
          <div className="toast-pill">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#86efac' }}>check_circle</span>
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
         ══════════════════════════════════════════════════════════════════ */}

      {/* 1. Register New Ambulance Modal */}
      {showAddAmbulanceModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Register New Ambulance Vehicle</h3>
              <button type="button" className="icon-btn" onClick={() => setShowAddAmbulanceModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddAmbulance} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  VEHICLE REGISTRATION NUMBER *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BR-31-AB-1042"
                  value={newVehicleNumber}
                  onChange={(e) => setNewVehicleNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  PRIMARY DRIVER NAME
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ram Prasad"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  DRIVER CONTACT PHONE
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. +91 9431 777701"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddAmbulanceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Ambulance Details Modal */}
      {showEditAmbulanceModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Edit Ambulance Details</h3>
              <button type="button" className="icon-btn" onClick={() => setShowEditAmbulanceModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditAmbulanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  VEHICLE REGISTRATION NUMBER
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editVehicleNumber}
                  onChange={(e) => setEditVehicleNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  DRIVER NAME
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editDriverName}
                  onChange={(e) => setEditDriverName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  DRIVER CONTACT PHONE
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editDriverPhone}
                  onChange={(e) => setEditDriverPhone(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditAmbulanceModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Emergency 108 Dispatch Modal */}
      {showDispatchModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--emergency-red)' }}>
                  emergency
                </span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Dispatch Emergency 108 Ambulance</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowDispatchModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEmergencyDispatch} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  SELECT AVAILABLE VEHICLE
                </label>
                <select
                  className="form-input"
                  value={selectedAmbulanceForDispatch}
                  onChange={(e) => setSelectedAmbulanceForDispatch(e.target.value)}
                >
                  <option value="">First Available Standby Ambulance</option>
                  {availableAmbulances.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.vehicle} — Driver: {a.driver || 'Assigned'} ({a.driverPhone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  EMERGENCY PICKUP LOCATION *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramnagar Village Chowk / Sector 4 Primary School"
                  value={dispatchPickup}
                  onChange={(e) => setDispatchPickup(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                    PATIENT NAME (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Patient Name"
                    value={dispatchPatientName}
                    onChange={(e) => setDispatchPatientName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                    TRIAGE URGENCY
                  </label>
                  <select
                    className="form-input"
                    value={dispatchUrgency}
                    onChange={(e) => setDispatchUrgency(e.target.value)}
                  >
                    <option value="emergency">🚨 Critical Emergency / Trauma</option>
                    <option value="high">Priority Urgent Transfer</option>
                    <option value="routine">Routine Transport</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  DISPATCH NOTES / CLINICAL CONTEXT
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Severe blood loss, oxygen cylinder required..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowDispatchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                  Confirm & Dispatch 108
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Accept Referral Modal */}
      {showAcceptReferralModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-card" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Accept Referral & Assign Ward</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--on-surface-variant)' }}>
                  Patient: <b>{showAcceptReferralModal.patientName}</b> · Dr. {showAcceptReferralModal.referringDoctor}
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowAcceptReferralModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleConfirmAcceptReferral} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  ASSIGNED WARD & BED NUMBER *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. General Ward - Bed 04 / ICU Bed 02"
                  value={assignedBedInput}
                  onChange={(e) => setAssignedBedInput(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  RECEIVING CLINICAL DEPARTMENT
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={assignedDeptInput}
                  onChange={(e) => setAssignedDeptInput(e.target.value)}
                  placeholder="e.g. General Medicine, Emergency Trauma..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, marginBottom: 4, color: 'var(--on-surface-variant)' }}>
                  TRIAGE & ADMISSION INSTRUCTIONS
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Patient arriving via 108. Direct immediately to triage bay..."
                  value={referralResponseNotes}
                  onChange={(e) => setReferralResponseNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAcceptReferralModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Admission & Reserve Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Hospital Location Picker Modal */}
      <HospitalLocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        hospitalId={hospital.id}
        initialLocation={{
          latitude: hospitalLocation.latitude ?? hospital.latitude,
          longitude: hospitalLocation.longitude ?? hospital.longitude,
          address: hospitalLocation.address || hospital.address,
        }}
        onLocationSaved={(saved) => {
          setHospitalLocation(saved);
          showToast(`Hospital map coordinates saved: ${saved.address || 'Updated'}`);
          hospitals.reload?.();
        }}
      />
    </div>
  );
}
