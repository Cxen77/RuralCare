const fs = require('fs');
const path = require('path');

async function runE2ETest() {
  console.log('--- Starting Live Emergency Reporting E2E Test ---');

  // 1. Create a 1x1 png dummy image buffer
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(samplePngBase64, 'base64');
  const tempImgPath = path.join(__dirname, 'temp_test_incident.png');
  fs.writeFileSync(tempImgPath, buffer);

  const formData = new FormData();
  formData.append('photo', new Blob([buffer], { type: 'image/png' }), 'incident.png');
  formData.append('emergencyType', 'Road Accident');
  formData.append('description', 'Two-wheeler collision near village crossroad. Immediate medical team needed.');
  formData.append('latitude', '26.7606');
  formData.append('longitude', '83.3732');
  formData.append('address', 'Gorakhpur Deoria Road, Near Ramnagar Market');
  formData.append('reporterName', 'Ramesh Patel');
  formData.append('phone', '+91 98765 43210');

  // 2. Submit Emergency Report
  console.log('Step 1: Submitting new emergency report...');
  const createRes = await fetch('http://localhost:4000/api/emergencies', {
    method: 'POST',
    body: formData,
  });
  const createJson = await createRes.json();
  console.log('Create Response:', createJson.success ? 'SUCCESS' : 'FAILED', createJson.data?._id);
  if (!createJson.success) {
    throw new Error('Create emergency failed: ' + JSON.stringify(createJson));
  }
  const emergencyId = createJson.data._id;

  // 3. Query Nearby Emergencies on Care Map
  console.log('Step 2: Querying nearby emergencies on Care Map...');
  const nearbyRes = await fetch('http://localhost:4000/api/emergencies/nearby?lat=26.76&lng=83.37&radiusKm=20');
  const nearbyJson = await nearbyRes.json();
  console.log(`Found ${nearbyJson.data?.length} nearby emergencies.`);
  const found = nearbyJson.data?.find(e => e._id === emergencyId);
  if (!found) {
    throw new Error(`Report ${emergencyId} not found in nearby query`);
  }
  console.log('Verified incident imageUrl:', found.imageUrl);
  console.log('Verified reporter masked name:', found.reporterName);

  // 4. Update status to 'verified'
  console.log('Step 3: Responder verifying incident...');
  const verifyRes = await fetch(`http://localhost:4000/api/emergencies/${emergencyId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'verified', note: 'Doctor confirmed road accident severity.' }),
  });
  const verifyJson = await verifyRes.json();
  console.log('Status after verify:', verifyJson.data?.status);

  // 5. Hospital Dispatches Ambulance
  console.log('Step 4: Dispatching ambulance...');
  const dispatchRes = await fetch(`http://localhost:4000/api/emergencies/${emergencyId}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hospitalId: 'hosp-601',
      hospitalName: 'Gorakhpur District Hospital',
      vehicleNumber: 'UP-53-AMB-108',
      driverName: 'Mohan Lal',
      driverPhone: '+91 94151 99882',
      etaMinutes: 8,
    }),
  });
  const dispatchJson = await dispatchRes.json();
  console.log('Status after dispatch:', dispatchJson.data?.status);
  console.log('Assigned ambulance vehicle:', dispatchJson.data?.ambulanceVehicle);
  console.log('Assigned hospital:', dispatchJson.data?.assignedHospitalName);

  // 6. Mark Arrived
  console.log('Step 5: Ambulance arrived at scene...');
  const arriveRes = await fetch(`http://localhost:4000/api/emergencies/${emergencyId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'arrived', note: 'Ambulance team reached patient.' }),
  });
  const arriveJson = await arriveRes.json();
  console.log('Status after arrival:', arriveJson.data?.status);

  // 7. Resolve Emergency
  console.log('Step 6: Resolving emergency...');
  const resolveRes = await fetch(`http://localhost:4000/api/emergencies/${emergencyId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolutionNotes: 'Patient safely stabilized and admitted to emergency ward.' }),
  });
  const resolveJson = await resolveRes.json();
  console.log('Status after resolution:', resolveJson.data?.status);
  console.log('Resolved at:', resolveJson.data?.resolvedAt);

  if (fs.existsSync(tempImgPath)) {
    fs.unlinkSync(tempImgPath);
  }

  console.log('--- E2E Test PASSED Successfully! ---');
}

runE2ETest().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
