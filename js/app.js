/**
 * RuralCare Network Platform - Patient App Prototype Logic
 * Built according to Stitch Design Tokens & UX Flows
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Live Notch Clock
  updateNotchClock();
  setInterval(updateNotchClock, 30000);

  function updateNotchClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const clockEl = document.getElementById('deviceTime');
    if (clockEl) clockEl.textContent = `${hours}:${minutes}`;
  }

  // 2. Tab Navigation
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  const tabScreens = document.querySelectorAll('.tab-screen');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetScreenId = item.getAttribute('data-target');
      switchTab(targetScreenId);
    });
  });

  function switchTab(screenId) {
    // Update active nav button
    navItems.forEach(nav => {
      const isTarget = nav.getAttribute('data-target') === screenId;
      nav.classList.toggle('active', isTarget);
      const icon = nav.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.style.fontVariationSettings = isTarget ? "'FILL' 1" : "'FILL' 0";
      }
    });

    // Update active screen
    tabScreens.forEach(screen => {
      screen.classList.toggle('active', screen.id === screenId);
    });

    // Scroll to top of app content
    const content = document.querySelector('.app-content');
    if (content) content.scrollTop = 0;
  }

  // Quick jump button triggers
  document.getElementById('headerProfileChip')?.addEventListener('click', () => switchTab('screen-profile'));
  document.getElementById('startTriageCtaBtn')?.addEventListener('click', () => switchTab('screen-triage'));
  document.getElementById('homeUpcomingApptCard')?.addEventListener('click', () => switchTab('screen-doctors'));
  document.getElementById('homePrescriptionCard')?.addEventListener('click', () => switchTab('screen-meds'));
  document.getElementById('viewAllDoctorsBtn')?.addEventListener('click', () => switchTab('screen-doctors'));
  document.getElementById('catDoctorsTile')?.addEventListener('click', () => switchTab('screen-doctors'));
  document.getElementById('catPharmaciesTile')?.addEventListener('click', () => switchTab('screen-meds'));
  document.getElementById('catHospitalsTile')?.addEventListener('click', () => {
    switchTab('screen-doctors');
    showToast('2 Community Health Centers available near Ramnagar');
  });

  // 3. AI Triage Mode Toggle (Voice vs Chat)
  const btnModeVoice = document.getElementById('btnModeVoice');
  const btnModeChat = document.getElementById('btnModeChat');
  const voiceTriageView = document.getElementById('voiceTriageView');
  const chatTriageView = document.getElementById('chatTriageView');

  btnModeVoice?.addEventListener('click', () => {
    btnModeVoice.classList.add('active');
    btnModeChat.classList.remove('active');
    voiceTriageView.style.display = 'block';
    chatTriageView.style.display = 'none';
  });

  btnModeChat?.addEventListener('click', () => {
    btnModeChat.classList.add('active');
    btnModeVoice.classList.remove('active');
    voiceTriageView.style.display = 'none';
    chatTriageView.style.display = 'block';
  });

  // 4. Voice Triage Interactive Simulation
  const voiceMicBtn = document.getElementById('interactiveVoiceMicBtn');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const pulseRings = [
    document.getElementById('pulseRing1'),
    document.getElementById('pulseRing2'),
    document.getElementById('pulseRing3')
  ];
  const symptomsList = document.getElementById('symptomsList');
  let isListening = false;
  let voiceTimeout = null;

  voiceMicBtn?.addEventListener('click', () => {
    if (isListening) {
      stopListening('Processed voice input.');
    } else {
      startListening();
    }
  });

  function startListening() {
    isListening = true;
    voiceMicBtn.classList.add('listening');
    pulseRings.forEach(ring => ring.style.display = 'block');
    voiceStatusText.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; color:var(--primary);">graphic_eq</span> Listening... Speak now';
    
    // Simulate speech detection progression
    voiceTimeout = setTimeout(() => {
      voiceStatusText.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; color:var(--secondary);">autorenew</span> Analyzing clinical symptoms...';
      
      setTimeout(() => {
        stopListening('Symptoms updated from voice input');
        showExtractedSymptoms([
          'Acute abdominal discomfort',
          'Mild Fever (100.2°F)',
          'Nausea after meals',
          'Duration: 2 days'
        ]);
        showToast('Voice analyzed successfully: 4 clinical signs extracted');
      }, 2000);
    }, 3000);
  }

  function stopListening(message) {
    isListening = false;
    clearTimeout(voiceTimeout);
    voiceMicBtn.classList.remove('listening');
    pulseRings.forEach(ring => ring.style.display = 'none');
    voiceStatusText.innerHTML = '<span style="color:var(--tertiary);">Ready • Tap to record more</span>';
  }

  function showExtractedSymptoms(symptoms) {
    if (!symptomsList) return;
    symptomsList.innerHTML = '';
    symptoms.forEach((symptom, idx) => {
      const chip = document.createElement('span');
      chip.className = idx === symptoms.length - 1 ? 'symptom-chip duration' : 'symptom-chip';
      chip.textContent = symptom;
      symptomsList.appendChild(chip);
    });
  }

  document.getElementById('btnConfirmVoiceTriage')?.addEventListener('click', () => {
    switchTab('screen-doctors');
    showToast('Filtered doctors matching your General Medicine triage');
  });

  document.getElementById('btnResetVoiceTriage')?.addEventListener('click', () => {
    showExtractedSymptoms(['Stomach pain (Sharp)', 'Mild Nausea', 'Started 2 days ago']);
    voiceStatusText.innerHTML = '<span>Tap to Speak</span>';
    showToast('Triage reset');
  });

  // 5. Chat Assistant Interactive Messages
  const chatMessages = document.getElementById('chatMessages');
  const chatInputField = document.getElementById('chatInputField');
  const chatSendBtn = document.getElementById('chatSendBtn');

  chatSendBtn?.addEventListener('click', sendChatMessage);
  chatInputField?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  function sendChatMessage() {
    const text = chatInputField.value.trim();
    if (!text) return;
    
    appendUserBubble(text);
    chatInputField.value = '';

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Simulate AI response
    setTimeout(() => {
      generateAiResponse(text);
    }, 900);
  }

  window.sendQuickReply = function(text) {
    appendUserBubble(text);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    setTimeout(() => {
      generateAiResponse(text);
    }, 800);
  };

  function appendUserBubble(text) {
    const userRow = document.createElement('div');
    userRow.className = 'chat-bubble-row user';
    userRow.innerHTML = `<div class="chat-bubble">${escapeHtml(text)}</div>`;
    chatMessages.appendChild(userRow);
  }

  function appendAiBubble(htmlContent) {
    const aiRow = document.createElement('div');
    aiRow.className = 'chat-bubble-row ai';
    aiRow.innerHTML = `
      <div class="chat-avatar">
        <span class="material-symbols-outlined">smart_toy</span>
      </div>
      <div class="chat-bubble">${htmlContent}</div>
    `;
    chatMessages.appendChild(aiRow);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function generateAiResponse(userInput) {
    const lower = userInput.toLowerCase();
    let reply = '';

    if (lower.includes('stomach') || lower.includes('pain') || lower.includes('ache') || lower.includes('right side')) {
      reply = `
        Thank you for describing that. Localized abdominal discomfort may indicate gastroenteritis, acidity, or biliary colic.
        <div class="chat-action-card">
          <span style="font-size: 11px; font-weight: 700; color: var(--secondary);">Clinical Recommendation</span>
          <p style="font-size: 11px; color: var(--on-surface-variant);">We suggest an evaluation with Dr. Anita Sharma today at 2:00 PM at Ramnagar PHC.</p>
          <button class="btn-book-slot" onclick="window.openBookingModal('Dr. Anita Sharma', 'General Physician', 'Ramnagar PHC')">
            Book Appointment Now
          </button>
        </div>
      `;
    } else if (lower.includes('fever') || lower.includes('paracetamol')) {
      reply = `
        If fever exceeds 101°F or persists over 48 hours, please stay hydrated with ORS and visit the clinic for a rapid malaria/typhoid blood smear test.
      `;
    } else if (lower.includes('dizzy') || lower.includes('emergency')) {
      reply = `
        <span style="color:var(--error-dark); font-weight:700;">Urgent Notice:</span> Dizziness with fever may indicate dehydration. Please drink clean fluids. If breathing is difficult, press the SOS button immediately.
      `;
    } else {
      reply = `
        I have recorded this symptom for your health record. Would you like to connect with a doctor on call or schedule a clinic visit?
        <div style="margin-top:6px; display:flex; gap:6px;">
          <button class="btn-book-slot" onclick="window.switchTab('screen-doctors')">Browse Doctors</button>
        </div>
      `;
    }

    appendAiBubble(reply);
  }

  document.getElementById('chatBookSlotBtn')?.addEventListener('click', () => {
    window.openBookingModal('Dr. Anita Sharma', 'General Physician', 'Ramnagar PHC');
  });

  // 6. Doctor Search & Specialty Filter
  const doctorSearchInput = document.getElementById('doctorSearchInput');
  const specialtyPills = document.querySelectorAll('.specialty-pill');
  const doctorCards = document.querySelectorAll('.doctor-card');

  specialtyPills.forEach(pill => {
    pill.addEventListener('click', () => {
      specialtyPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterDoctors();
    });
  });

  doctorSearchInput?.addEventListener('input', filterDoctors);

  function filterDoctors() {
    const activeSpecialty = document.querySelector('.specialty-pill.active')?.getAttribute('data-specialty') || 'all';
    const searchQuery = doctorSearchInput.value.toLowerCase().trim();

    doctorCards.forEach(card => {
      const cardSpecialty = card.getAttribute('data-specialty') || '';
      const cardText = card.textContent.toLowerCase();

      const matchesSpecialty = (activeSpecialty === 'all' || cardSpecialty.toLowerCase() === activeSpecialty.toLowerCase());
      const matchesSearch = (!searchQuery || cardText.includes(searchQuery));

      card.style.display = (matchesSpecialty && matchesSearch) ? 'flex' : 'none';
    });
  }

  // 7. Booking Modal Flow
  const bookingModal = document.getElementById('bookingModalOverlay');
  const closeBookingModalBtn = document.getElementById('closeBookingModalBtn');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  const modalDoctorName = document.getElementById('modalDoctorName');
  const modalDoctorClinic = document.getElementById('modalDoctorClinic');

  window.openBookingModal = function(name, specialty, clinic) {
    if (modalDoctorName) modalDoctorName.textContent = `Book with ${name}`;
    if (modalDoctorClinic) modalDoctorClinic.textContent = `${specialty} • ${clinic}`;
    if (bookingModal) bookingModal.classList.add('active');
  };

  closeBookingModalBtn?.addEventListener('click', () => {
    bookingModal.classList.remove('active');
  });

  // Time slot & Date slot pills interaction
  document.querySelectorAll('#dateSlotGrid .time-slot-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#dateSlotGrid .time-slot-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  document.querySelectorAll('#timeSlotGrid .time-slot-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#timeSlotGrid .time-slot-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  confirmBookingBtn?.addEventListener('click', () => {
    bookingModal.classList.remove('active');
    const selectedSlot = document.querySelector('#timeSlotGrid .time-slot-pill.active')?.textContent || '2:00 PM';
    const selectedDate = document.querySelector('#dateSlotGrid .time-slot-pill.active')?.textContent || 'Today';
    showToast(`Appointment Confirmed for ${selectedDate} at ${selectedSlot}! SMS sent.`);
  });

  // 8. Prescription QR Code Modal
  const qrModal = document.getElementById('qrModalOverlay');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const qrModalTitle = document.getElementById('qrModalTitle');
  const qrModalRxCode = document.getElementById('qrModalRxCode');

  window.showQrModal = function(medName, rxCode) {
    if (qrModalTitle) qrModalTitle.textContent = `${medName} Digital Rx`;
    if (qrModalRxCode) qrModalRxCode.textContent = rxCode;
    if (qrModal) qrModal.classList.add('active');
  };

  closeQrModalBtn?.addEventListener('click', () => {
    qrModal.classList.remove('active');
  });

  window.requestRefill = function(medName) {
    showToast(`Refill request for ${medName} sent to Gramin Seva Medicals.`);
  };

  // 9. Emergency SOS Modal & Countdown
  const sosModal = document.getElementById('sosModalOverlay');
  const sosCountdownNumber = document.getElementById('sosCountdownNumber');
  const cancelSosBtn = document.getElementById('cancelSosBtn');
  const sosCallNowBtn = document.getElementById('sosCallNowBtn');
  let sosTimer = null;
  let sosCount = 5;

  function triggerEmergencySos() {
    sosCount = 5;
    if (sosCountdownNumber) sosCountdownNumber.textContent = sosCount;
    sosModal.classList.add('active');

    clearInterval(sosTimer);
    sosTimer = setInterval(() => {
      sosCount--;
      if (sosCountdownNumber) sosCountdownNumber.textContent = sosCount;

      if (sosCount <= 0) {
        clearInterval(sosTimer);
        sosModal.classList.remove('active');
        showToast('Connecting to National Emergency Ambulance 108...');
      }
    }, 1000);
  }

  document.getElementById('headerSosBtn')?.addEventListener('click', triggerEmergencySos);
  document.getElementById('homeSosTriggerBtn')?.addEventListener('click', triggerEmergencySos);

  cancelSosBtn?.addEventListener('click', () => {
    clearInterval(sosTimer);
    sosModal.classList.remove('active');
    showToast('Emergency SOS Cancelled');
  });

  sosCallNowBtn?.addEventListener('click', () => {
    clearInterval(sosTimer);
    sosModal.classList.remove('active');
    showToast('Dialing 108 Emergency Ambulance...');
  });

  // 10. Language Switcher Toast
  document.getElementById('languageSelect')?.addEventListener('change', (e) => {
    const lang = e.target.options[e.target.selectedIndex].text;
    showToast(`Language switched to ${lang}`);
  });

  // 11. Toast Utility
  const toast = document.getElementById('appToast');
  const toastMsg = document.getElementById('toastMsg');
  let toastTimeout = null;

  function showToast(msg) {
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('active');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('active');
    }, 3200);
  }

  // Global helper for inline handlers
  window.switchTab = switchTab;
  window.showToast = showToast;

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
});
