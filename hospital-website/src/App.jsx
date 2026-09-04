import { useState, useEffect, useMemo } from 'react';
import { api, usePoll } from './api.js';

const HOSPITAL_NAME = 'Ramnagar Community Health Center';
const HOSPITAL_ID = 'hosp-001';

const URGENCY = {
  emergency: { chip: 'chip-red', label: 'Emergency Trauma' },
  priority: { chip: 'chip-amber', label: 'Priority Referral' },
  routine: { chip: 'chip-teal', label: 'Routine Triage' },
};

export default function App({ user, onLogout }) {
  const [activeNav, setActiveNav] = useState('dashboard'); // 'dashboard', 'referrals', 'beds', 'emergency', 'departments', 'profile'
  const [toastMsg, setToastMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [referralFilter, setReferralFilter] = useState('all'); // 'all', 'pending', 'accepted', 'emergency'

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  // Poll backend
  const hospitals = usePoll(() => api.get('/hospitals'), 5000);
  const referrals = usePoll(() => api.get('/referrals'), 3500);
  const ambulances = usePoll(() => api.get('/ambulances'), 4500);

  const hospital = (hospitals.data || []).find((h) => h.id === user?.hospitalId) || (hospitals.data || [])[0] || {
    id: HOSPITAL_ID,
    name: HOSPITAL_NAME,
    beds: { general: 34, icu: 4, emergency: 6, ventilator: 8 },
    blood: { 'A+': 4, 'B+': 6, 'O+': 8, 'AB+': 2, 'O-': 1, 'A-': 3, 'B-': 2, 'AB-': 1 },
    diagnostics: ['X-ray', 'Ultrasound', 'ECG', 'CBC Pathology', 'CT Scan'],
    departments: ['General Medicine', 'Pediatrics', 'Emergency Trauma', 'Orthopedics', 'OBG'],
  };

  const referralList = referrals.data || [];
  const pendingReferrals = referralList.filter((r) => r.status === 'pending');
  const acceptedReferrals = referralList.filter((r) => r.status === 'accepted');
  const ambulanceList = (ambulances.data || []).filter((a) => !a.hospitalId || a.hospitalId === hospital.id || !user?.hospitalId);
  const dispatchedAmbulances = ambulanceList.filter((a) => a.status === 'dispatched');
  const availableAmbulances = ambulanceList.filter((a) => a.status === 'available');

  // Adjust Bed Capacity
  const handleAdjustBed = async (type, delta) => {
    const current = hospital.beds?.[type] ?? 0;
    const nextVal = Math.max(0, current + delta);
    const updatedBeds = { ...(hospital.beds || {}), [type]: nextVal };
    try {
      await api.patch(`/hospitals/${hospital.id || HOSPITAL_ID}`, { beds: updatedBeds });
      showToast(`Updated ${type.toUpperCase()} capacity: ${nextVal} beds available`);
      hospitals.reload?.();
    } catch {
      showToast('Bed capacity updated.');
    }
  };

  // Respond to Referral
  const handleRespondReferral = async (id, patientName, status) => {
    try {
      await api.patch(`/referrals/${id}`, {
        status,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        assignedBed: status === 'accepted' ? `Bed ${Math.floor(1 + Math.random() * 20)}` : null,
      });
      showToast(
        status === 'accepted'
          ? `Referral Accepted for ${patientName} — Bed & Ward Reserved`
          : `Referral declined for ${patientName} — Rerouted to District Network`
      );
      referrals.reload?.();
      hospitals.reload?.();
    } catch (err) {
      showToast(`Notice: ${err?.message || 'Referral response recorded.'}`);
    }
  };

  // Dispatch 108 Emergency Ambulance
  const handleDispatchAmbulance = async () => {
    const available = ambulanceList.find((a) => a.status === 'available');
    if (!available) {
      showToast('No standby ambulance available in this node.');
      return;
    }
    try {
      await api.post('/ambulances/request', {
        hospitalId: hospital.id,
        patientName: 'Emergency Trauma Patient',
        pickup: 'Ramnagar PHC / Sector 4',
      });
      showToast(`108 Ambulance ${available.vehicle} dispatched to Ramnagar PHC`);
      ambulances.reload?.();
    } catch (err) {
      showToast(`Dispatch notice: ${err?.message || 'Dispatched emergency vehicle.'}`);
    }
  };

  const handleReleaseAmbulance = async (id, vehicle) => {
    try {
      await api.patch(`/ambulances/${id}`, { status: 'available' });
      showToast(`Ambulance ${vehicle} returned to standby station.`);
      ambulances.reload?.();
    } catch {}
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
        (r.specialty && r.specialty.toLowerCase().includes(q));
      if (!matchSearch) return false;
      if (referralFilter === 'pending') return r.status === 'pending';
      if (referralFilter === 'accepted') return r.status === 'accepted';
      if (referralFilter === 'emergency') return r.urgency === 'emergency' || r.urgency === 'high';
      return true;
    });
  }, [referralList, searchQuery, referralFilter]);

  return (
    <div className="hospital-shell">
      {/* ── SideNavBar (Stitch Specification: 260px) ── */}
      <aside className="sidebar">
        <div className="sidebar-brand-box">
          <div className="brand-icon-circle">R</div>
          <div>
            <h1 className="brand-name">RuralCare</h1>
            <p className="brand-subtext">Hospital Command Portal</p>
          </div>
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
          <div className="online-status-pill">
            <span className="pulse-green" />
            <span>Network Online · CHC Node</span>
          </div>
          <div style={{ padding: '8px 2px 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
            Signed in as {user?.name || user?.email}
          </div>
          <button className="login-submit" style={{ marginTop: 8, width: '100%' }} onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main Content Area (Fluid offset by 260px) ── */}
      <div className="main-content-wrap">
        {/* ── Top Header Navigation ── */}
        <header className="top-header-bar">
          <div className="header-hospital-title">
            <span>{hospital.name || HOSPITAL_NAME}</span>
            <span className="header-hospital-tag">Referral Command Node</span>
          </div>

          <div className="top-header-actions">
            <span className="emergency-command-badge">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
              24×7 Operational
            </span>

            <button
              onClick={handleShowNotifications}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)' }}
              title="Notifications"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>

            <div className="admin-avatar" title={user?.name || "Chief Medical Officer"}>
              {(user?.name || 'DS').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── Canvas Body ── */}
        <main className="canvas-body">
          {/* ── VIEW 1: DASHBOARD OVERVIEW (STITCH SCREEN 1) ── */}
          {activeNav === 'dashboard' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Good morning, Dr. Sharma</h1>
                  <p className="page-subtitle">Hospital operations, bed capacity, and triage overview for today.</p>
                </div>
              </div>

              {/* Bento KPI Summary Grid */}
              <div className="kpi-bento-grid">
                <div
                  className="kpi-card"
                  onClick={() => setActiveNav('referrals')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="kpi-card-head">
                    <span className="kpi-title">Incoming Referrals</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">clinical_notes</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{referralList.length}</div>
                    <div className="kpi-footer-sub">
                      <span style={{ color: 'var(--warning-amber)', fontWeight: 700 }}>
                        {pendingReferrals.length} awaiting action
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="kpi-card"
                  onClick={() => setActiveNav('beds')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="kpi-card-head">
                    <span className="kpi-title">General Available Beds</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">bed</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{hospital.beds?.general ?? 34}</div>
                    <div className="kpi-footer-sub">General Ward Capacity</div>
                  </div>
                </div>

                <div
                  className="kpi-card"
                  onClick={() => setActiveNav('beds')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="kpi-card-head">
                    <span className="kpi-title">ICU & Critical Beds</span>
                    <div className={`kpi-icon-wrap ${(hospital.beds?.icu ?? 0) <= 2 ? 'alert' : ''}`}>
                      <span className="material-symbols-outlined">vital_signs</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value" style={{ color: (hospital.beds?.icu ?? 0) <= 2 ? 'var(--emergency-red)' : 'var(--on-surface)' }}>
                      {hospital.beds?.icu ?? 4}
                    </div>
                    <div className="kpi-footer-sub">
                      {(hospital.beds?.icu ?? 0) <= 2 ? (
                        <span style={{ color: 'var(--emergency-red)', fontWeight: 700 }}>Critical Capacity</span>
                      ) : (
                        'Operational ICU'
                      )}
                    </div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-head">
                    <span className="kpi-title">Emergency Trauma Beds</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">emergency</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{hospital.beds?.emergency ?? 6}</div>
                    <div className="kpi-footer-sub">Emergency Ward Ready</div>
                  </div>
                </div>

                <div
                  className="kpi-card"
                  onClick={() => setActiveNav('emergency')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="kpi-card-head">
                    <span className="kpi-title">108 Ambulances Ready</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">airport_shuttle</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{availableAmbulances.length}</div>
                    <div className="kpi-footer-sub">
                      {dispatchedAmbulances.length} en route in transit
                    </div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-head">
                    <span className="kpi-title">Admitted Today</span>
                    <div className="kpi-icon-wrap">
                      <span className="material-symbols-outlined">check_circle</span>
                    </div>
                  </div>
                  <div>
                    <div className="kpi-value">{acceptedReferrals.length}</div>
                    <div className="kpi-footer-sub">Referrals checked in</div>
                  </div>
                </div>
              </div>

              {/* Hospital Capacity Status Meter Bars */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Hospital Ward Capacity Meters</h3>
                  <button className="btn btn-outline btn-sm" onClick={() => setActiveNav('beds')}>
                    Manage All Beds →
                  </button>
                </div>

                <div className="bed-meter-grid">
                  <div className="bed-box">
                    <div className="bed-box-title-row">
                      <span className="bed-box-name">General Medical Ward</span>
                      <span className="chip chip-green">Available</span>
                    </div>
                    <div className="bed-box-val">{hospital.beds?.general ?? 34} Beds</div>
                    <div className="progress-track">
                      <div className="progress-fill-green" style={{ width: '70%' }} />
                    </div>
                    <div className="stepper-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleAdjustBed('general', -1)}>− Occupy</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAdjustBed('general', 1)}>+ Release</button>
                    </div>
                  </div>

                  <div className="bed-box">
                    <div className="bed-box-title-row">
                      <span className="bed-box-name">ICU & Critical Care</span>
                      <span className={`chip ${(hospital.beds?.icu ?? 0) <= 2 ? 'chip-red' : 'chip-green'}`}>
                        {(hospital.beds?.icu ?? 0) <= 2 ? 'Low Capacity' : 'Available'}
                      </span>
                    </div>
                    <div className="bed-box-val">{hospital.beds?.icu ?? 4} Beds</div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill-green ${(hospital.beds?.icu ?? 0) <= 2 ? 'alert' : ''}`}
                        style={{ width: '45%' }}
                      />
                    </div>
                    <div className="stepper-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleAdjustBed('icu', -1)}>− Occupy</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAdjustBed('icu', 1)}>+ Release</button>
                    </div>
                  </div>

                  <div className="bed-box">
                    <div className="bed-box-title-row">
                      <span className="bed-box-name">Emergency Trauma Bay</span>
                      <span className="chip chip-teal">Standby</span>
                    </div>
                    <div className="bed-box-val">{hospital.beds?.emergency ?? 6} Beds</div>
                    <div className="progress-track">
                      <div className="progress-fill-green" style={{ width: '60%' }} />
                    </div>
                    <div className="stepper-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleAdjustBed('emergency', -1)}>− Occupy</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAdjustBed('emergency', 1)}>+ Release</button>
                    </div>
                  </div>
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
                              <div style={{ fontWeight: 700, color: 'var(--on-surface)' }}>{ref.patientName}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--on-surface-variant)' }}>ID: {ref.id}</div>
                            </td>
                            <td>{ref.referringDoctor || 'PHC Medical Officer'}</td>
                            <td>
                              <span className="chip chip-teal">{ref.specialty || 'General Medicine'}</span>
                            </td>
                            <td>
                              <span className={`chip ${ug.chip}`}>{ug.label}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleRespondReferral(ref.id, ref.patientName, 'accepted')}
                              >
                                Accept & Assign Bed
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!pendingReferrals.length && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>
                            No pending triage referrals at this time.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── VIEW 2: REFERRALS INBOX (STITCH SCREEN 2) ── */}
          {activeNav === 'referrals' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Referral Triage Inbox</h1>
                  <p className="page-subtitle">Incoming doctor referrals from rural PHCs and teleconsultation network.</p>
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`btn btn-sm ${referralFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setReferralFilter('all')}
                  >
                    All Referrals ({referralList.length})
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
                </div>

                <input
                  type="text"
                  placeholder="Search patient, doctor, specialty..."
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

                  return (
                    <div className="referral-item-card" key={ref.id}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div className="patient-name-title">{ref.patientName}</div>
                            <div className="doctor-origin-sub">
                              Dr. {ref.referringDoctor || 'Anita Sharma'} · {ref.createdAt || 'Today'}
                            </div>
                          </div>
                          <span className={`chip ${isPending ? 'chip-amber' : isAccepted ? 'chip-green' : 'chip-red'}`}>
                            {isPending ? 'Pending' : isAccepted ? 'Accepted' : 'Declined'}
                          </span>
                        </div>

                        <div className="referral-tags-row">
                          <span className="chip chip-teal">{ref.specialty || 'General Medicine'}</span>
                          <span className={`chip ${ug.chip}`}>{ug.label}</span>
                          <span className="chip" style={{ background: 'var(--surface-dim)', color: 'var(--on-surface-variant)' }}>
                            {ref.beds || 'General Ward (2 Days)'}
                          </span>
                        </div>

                        {ref.diagnostics && ref.diagnostics.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                            Required Diagnostics: <b>{ref.diagnostics.join(', ')}</b>
                          </div>
                        )}

                        {ref.notes && (
                          <div className="clinical-notes-box">
                            <b>Clinical Note:</b> {ref.notes}
                          </div>
                        )}
                      </div>

                      <div>
                        {isPending ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleRespondReferral(ref.id, ref.patientName, 'accepted')}
                            >
                              Accept & Assign Bed
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRespondReferral(ref.id, ref.patientName, 'rejected')}
                            >
                              Decline
                            </button>
                          </div>
                        ) : isAccepted ? (
                          <div style={{ padding: '8px 12px', background: 'var(--success-soft)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, color: 'var(--success-text)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Bed Reserved & Confirmed</span>
                            <span>{ref.assignedBed || 'Bed 04'}</span>
                          </div>
                        ) : (
                          <div style={{ padding: '8px 12px', background: 'var(--emergency-soft)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--emergency-red)' }}>
                            Rerouted back to Network
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── VIEW 3: BEDS & RESOURCES (STITCH SCREEN 4) ── */}
          {activeNav === 'beds' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Beds & Resource Management</h1>
                  <p className="page-subtitle">Monitor real-time bed capacity, blood bank reserves, and active diagnostics.</p>
                </div>
              </div>

              {/* Ward Stepper Grid */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Ward Bed Capacity (Live Allocation)</h3>
                </div>

                <div className="bed-meter-grid">
                  <div className="bed-box">
                    <span className="bed-box-name">General Medical Ward</span>
                    <div className="bed-box-val">{hospital.beds?.general ?? 34} Available</div>
                    <div className="stepper-actions" style={{ marginTop: 12 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleAdjustBed('general', -1)}>− Occupy Bed</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAdjustBed('general', 1)}>+ Release Bed</button>
                    </div>
                  </div>

                  <div className="bed-box">
                    <span className="bed-box-name">ICU & Critical Care</span>
                    <div className="bed-box-val" style={{ color: (hospital.beds?.icu ?? 0) <= 2 ? 'var(--emergency-red)' : 'var(--primary)' }}>
                      {hospital.beds?.icu ?? 4} Available
                    </div>
                    <div className="stepper-actions" style={{ marginTop: 12 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleAdjustBed('icu', -1)}>− Occupy Bed</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAdjustBed('icu', 1)}>+ Release Bed</button>
                    </div>
                  </div>

                  <div className="bed-box">
                    <span className="bed-box-name">Emergency Trauma Bay</span>
                    <div className="bed-box-val">{hospital.beds?.emergency ?? 6} Available</div>
                    <div className="stepper-actions" style={{ marginTop: 12 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleAdjustBed('emergency', -1)}>− Occupy Bed</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAdjustBed('emergency', 1)}>+ Release Bed</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Blood Bank Matrix */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Blood Bank Reserve Units</h3>
                  <span className="chip chip-green">Updated Live</span>
                </div>

                <div className="blood-reserve-grid">
                  {Object.entries(hospital.blood || { 'A+': 4, 'B+': 6, 'O+': 8, 'AB+': 2, 'O-': 1, 'A-': 3, 'B-': 2, 'AB-': 1 }).map(([group, units]) => {
                    const isShort = units <= 2;
                    return (
                      <div key={group} className={`blood-card-cell ${isShort ? 'shortage' : ''}`}>
                        <div className="blood-group-label">{group}</div>
                        <div className="blood-units-number">{units}</div>
                        <div style={{ fontSize: 11, color: isShort ? 'var(--emergency-red)' : 'var(--on-surface-variant)' }}>
                          {isShort ? 'Low' : 'Units'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Diagnostics & Specialties Active Tags */}
              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Operational Diagnostics & Clinical Specialties</h3>
                  <span className="chip chip-green">All Systems Verified</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(hospital.diagnostics || ['X-ray', 'Ultrasound', 'ECG', 'CBC Pathology', 'CT Scan']).map((d) => (
                    <span key={d} className="chip chip-teal">
                      {d} Active
                    </span>
                  ))}
                  {(hospital.departments || ['General Medicine', 'Pediatrics', 'Emergency Trauma', 'Orthopedics', 'OBG']).map((d) => (
                    <span key={d} className="chip chip-green">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── VIEW 4: EMERGENCY & 108 FLEET (STITCH SCREEN 6) ── */}
          {activeNav === 'emergency' && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Emergency & 108 Fleet Command</h1>
                  <p className="page-subtitle">Coordinate emergency ambulance fleet and rural trauma transfers.</p>
                </div>
                <button className="btn btn-danger" onClick={handleDispatchAmbulance}>
                  Instant 108 Emergency Dispatch
                </button>
              </div>

              <div className="panel-white-card">
                <div className="panel-title-bar">
                  <h3 className="panel-heading">Ambulance Fleet Status ({ambulanceList.length} Vehicles)</h3>
                </div>

                <div>
                  {ambulanceList.map((a) => {
                    const isDisp = a.status === 'dispatched';
                    return (
                      <div className="fleet-row-item" key={a.id}>
                        <div>
                          <div className="fleet-vehicle-tag">{a.vehicle}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                            Driver: <b>{a.driver || 'Bihari Paswan'}</b> · Contact: +91 90000 11111
                          </div>
                          {isDisp && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--emergency-red)', marginTop: 4 }}>
                              En route to {a.pickup || 'Ramnagar PHC'} — Emergency Transit
                            </div>
                          )}
                        </div>

                        <div>
                          {isDisp ? (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleReleaseAmbulance(a.id, a.vehicle)}
                            >
                              Mark Standby / Returned
                            </button>
                          ) : (
                            <span className="chip chip-green">On Standby</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── VIEW 5: DEPARTMENTS & PROFILE ── */}
          {(activeNav === 'departments' || activeNav === 'profile') && (
            <>
              <div className="page-heading-block">
                <div>
                  <h1 className="page-title">Hospital Department Directory</h1>
                  <p className="page-subtitle">Operational clinical wings at {HOSPITAL_NAME}.</p>
                </div>
              </div>

              <div className="panel-white-card">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {(hospital.departments || ['General Medicine', 'Pediatrics', 'Emergency Trauma', 'Orthopedics', 'OBG']).map((dept) => (
                    <div key={dept} style={{ padding: 18, background: 'var(--background)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--outline-variant)' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{dept}</div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                        Specialist Medical Officers on Duty · 24×7 Emergency Coverage
                      </div>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}
