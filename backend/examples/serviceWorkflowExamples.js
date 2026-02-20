/**
 * Service Workflow API Usage Examples
 * 
 * This file contains practical examples of using the service workflow APIs
 * with QR code tracking and work documentation.
 */

// ==================== SETUP ====================

const API_BASE_URL = 'http://localhost:3000/api';

// Example tokens (replace with actual authentication)
const WORKER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const CUSTOMER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// ==================== EXAMPLE 1: COMPLETE SERVICE WORKFLOW ====================

async function completeServiceWorkflow() {
  const bookingId = '65f1a2b3c4d5e6f7g8h9i0j1';
  
  console.log('====== COMPLETE SERVICE WORKFLOW ======\n');

  // Step 1: Worker generates start QR code
  console.log('1. Worker generates start QR code...');
  const startQRResponse = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/generate-start-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WORKER_TOKEN}`
      },
      body: JSON.stringify({
        jobDescriptionAcknowledged: true
      })
    }
  );
  const startQRData = await startQRResponse.json();
  console.log('Start QR Code:', startQRData.qrCode);
  console.log('Status:', startQRResponse.status, '\n');

  // Step 2: Customer scans start QR code
  console.log('2. Customer scans start QR code...');
  const scanStartResponse = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/scan-start-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CUSTOMER_TOKEN}`
      },
      body: JSON.stringify({
        qrCode: startQRData.qrCode,
        termsAccepted: true
      })
    }
  );
  const scanStartData = await scanStartResponse.json();
  console.log('Service started at:', scanStartData.startTime);
  console.log('Status:', scanStartData.booking.status, '\n');

  // Step 3: Worker uploads "before" photos
  console.log('3. Worker uploads before photos...');
  const beforePhoto1 = await uploadPhoto(bookingId, WORKER_TOKEN, {
    photoUrl: 'https://storage.example.com/photos/before1.jpg',
    type: 'before',
    notes: 'Living room - initial condition'
  });
  console.log('Before photo uploaded, total photos:', beforePhoto1.totalPhotos, '\n');

  // Step 4: Simulate service in progress
  console.log('4. Service in progress... (simulating work time)\n');
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds for demo

  // Step 5: Worker uploads "during" photos
  console.log('5. Worker uploads during photos...');
  const duringPhoto = await uploadPhoto(bookingId, WORKER_TOKEN, {
    photoUrl: 'https://storage.example.com/photos/during1.jpg',
    type: 'during',
    notes: 'Cleaning in progress'
  });
  console.log('During photo uploaded, total photos:', duringPhoto.totalPhotos, '\n');

  // Step 6: Worker uploads "after" photos
  console.log('6. Worker uploads after photos...');
  const afterPhoto = await uploadPhoto(bookingId, WORKER_TOKEN, {
    photoUrl: 'https://storage.example.com/photos/after1.jpg',
    type: 'after',
    notes: 'Work completed - living room'
  });
  console.log('After photo uploaded, total photos:', afterPhoto.totalPhotos, '\n');

  // Step 7: Worker adds additional notes
  console.log('7. Worker adds additional notes...');
  const notesResponse = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/work-documentation/notes`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WORKER_TOKEN}`
      },
      body: JSON.stringify({
        notes: 'All work completed as per requirements. Used eco-friendly cleaning products. Customer satisfied with the results.'
      })
    }
  );
  const notesData = await notesResponse.json();
  console.log('Notes updated:', notesData.message, '\n');

  // Step 8: Worker generates end QR code
  console.log('8. Worker generates end QR code...');
  const endQRResponse = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/generate-end-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WORKER_TOKEN}`
      }
    }
  );
  const endQRData = await endQRResponse.json();
  console.log('End QR Code:', endQRData.qrCode, '\n');

  // Step 9: Customer scans end QR code
  console.log('9. Customer scans end QR code...');
  const scanEndResponse = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/scan-end-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CUSTOMER_TOKEN}`
      },
      body: JSON.stringify({
        qrCode: endQRData.qrCode
      })
    }
  );
  const scanEndData = await scanEndResponse.json();
  console.log('Service completed!');
  console.log('Duration:', scanEndData.booking.actualDurationMinutes, 'minutes');
  console.log('Overtime:', scanEndData.booking.overtimeMinutes, 'minutes');
  console.log('Overtime charges:', scanEndData.booking.overtimeCharges);
  console.log('Total amount:', scanEndData.booking.totalAmount, '\n');

  // Step 10: View complete work documentation
  console.log('10. Viewing complete work documentation...');
  const docResponse = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/work-documentation`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CUSTOMER_TOKEN}`
      }
    }
  );
  const docData = await docResponse.json();
  console.log('Total photos:', docData.workDocumentation.photos.length);
  console.log('Additional notes:', docData.workDocumentation.additionalNotes);
  
  console.log('\n====== WORKFLOW COMPLETED ======\n');
}

// ==================== HELPER FUNCTIONS ====================

async function uploadPhoto(bookingId, token, photoData) {
  const response = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/upload-photo`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(photoData)
    }
  );
  return await response.json();
}

// ==================== EXAMPLE 2: OVERTIME SCENARIO ====================

async function overtimeScenarioExample() {
  console.log('====== OVERTIME SCENARIO ======\n');
  
  // Booking scheduled for 3 hours (10:00 AM - 1:00 PM)
  // Actual service: 10:05 AM - 1:35 PM (3.5 hours actual)
  
  const bookingId = '65f1a2b3c4d5e6f7g8h9i0j2';
  
  console.log('Scheduled duration: 3 hours (180 minutes)');
  console.log('Scheduled amount: ₹600\n');
  
  // Generate and scan start QR
  const startQR = await generateStartQR(bookingId, WORKER_TOKEN);
  await scanStartQR(bookingId, CUSTOMER_TOKEN, startQR.qrCode);
  console.log('Service started at 10:05 AM\n');
  
  // Simulate longer work time
  console.log('Work takes longer than expected...\n');
  
  // Generate and scan end QR
  const endQR = await generateEndQR(bookingId, WORKER_TOKEN);
  const endResult = await scanEndQR(bookingId, CUSTOMER_TOKEN, endQR.qrCode);
  
  console.log('Service ended at 1:35 PM');
  console.log('Actual duration:', endResult.booking.actualDurationMinutes, 'minutes (3.5 hours)');
  console.log('Overtime:', endResult.booking.overtimeMinutes, 'minutes (30 minutes)');
  console.log('Overtime charges: ₹', endResult.booking.overtimeCharges.toFixed(2));
  console.log('Updated total: ₹', endResult.booking.totalAmount.toFixed(2), '\n');
  
  console.log('Calculation:');
  console.log('- Hourly rate: ₹600 / 3 hours = ₹200/hour');
  console.log('- Overtime rate: ₹200 × 1.5 = ₹300/hour');
  console.log('- Overtime charge: 0.5 hours × ₹300 = ₹150');
  console.log('- New total: ₹600 + ₹150 = ₹750\n');
  
  console.log('====== OVERTIME SCENARIO COMPLETED ======\n');
}

async function generateStartQR(bookingId, token) {
  const response = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/generate-start-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ jobDescriptionAcknowledged: true })
    }
  );
  return await response.json();
}

async function scanStartQR(bookingId, token, qrCode) {
  const response = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/scan-start-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ qrCode, termsAccepted: true })
    }
  );
  return await response.json();
}

async function generateEndQR(bookingId, token) {
  const response = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/generate-end-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return await response.json();
}

async function scanEndQR(bookingId, token, qrCode) {
  const response = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/scan-end-qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ qrCode })
    }
  );
  return await response.json();
}

// ==================== EXAMPLE 3: WORK DOCUMENTATION ONLY ====================

async function workDocumentationExample() {
  const bookingId = '65f1a2b3c4d5e6f7g8h9i0j3';
  
  console.log('====== WORK DOCUMENTATION EXAMPLE ======\n');
  
  // Upload multiple photos
  console.log('Uploading work documentation photos...\n');
  
  const photos = [
    { type: 'before', url: 'photo1.jpg', notes: 'Kitchen - before' },
    { type: 'before', url: 'photo2.jpg', notes: 'Bathroom - before' },
    { type: 'before', url: 'photo3.jpg', notes: 'Living room - before' },
    { type: 'during', url: 'photo4.jpg', notes: 'Kitchen cleaning in progress' },
    { type: 'during', url: 'photo5.jpg', notes: 'Bathroom cleaning in progress' },
    { type: 'after', url: 'photo6.jpg', notes: 'Kitchen - completed' },
    { type: 'after', url: 'photo7.jpg', notes: 'Bathroom - completed' },
    { type: 'after', url: 'photo8.jpg', notes: 'Living room - completed' }
  ];
  
  for (let i = 0; i < photos.length; i++) {
    const result = await uploadPhoto(bookingId, WORKER_TOKEN, {
      photoUrl: `https://storage.example.com/${photos[i].url}`,
      type: photos[i].type,
      notes: photos[i].notes
    });
    console.log(`Photo ${i+1} uploaded: ${photos[i].notes} (${result.totalPhotos} total)`);
  }
  
  console.log('\nAll photos uploaded successfully!');
  console.log('Total photos:', photos.length);
  
  // Try to upload more than 10 photos (should fail)
  console.log('\nAttempting to upload 11th photo...');
  try {
    await uploadPhoto(bookingId, WORKER_TOKEN, {
      photoUrl: 'https://storage.example.com/photo11.jpg',
      type: 'after',
      notes: 'Extra photo'
    });
  } catch (error) {
    console.log('Expected error: Maximum 10 photos allowed');
  }
  
  // View all documentation
  console.log('\nRetrieving work documentation...');
  const docResponse = await fetch(
    `${API_BASE_URL}/bookings/${bookingId}/work-documentation`,
    {
      headers: { 'Authorization': `Bearer ${WORKER_TOKEN}` }
    }
  );
  const doc = await docResponse.json();
  
  console.log('\nWork Documentation Summary:');
  const beforePhotos = doc.workDocumentation.photos.filter(p => p.type === 'before');
  const duringPhotos = doc.workDocumentation.photos.filter(p => p.type === 'during');
  const afterPhotos = doc.workDocumentation.photos.filter(p => p.type === 'after');
  
  console.log(`- Before photos: ${beforePhotos.length}`);
  console.log(`- During photos: ${duringPhotos.length}`);
  console.log(`- After photos: ${afterPhotos.length}`);
  console.log(`- Total photos: ${doc.workDocumentation.photos.length}`);
  
  console.log('\n====== WORK DOCUMENTATION COMPLETED ======\n');
}

// ==================== EXAMPLE 4: ERROR HANDLING ====================

async function errorHandlingExamples() {
  const bookingId = '65f1a2b3c4d5e6f7g8h9i0j4';
  
  console.log('====== ERROR HANDLING EXAMPLES ======\n');
  
  // Example 1: Invalid QR code
  console.log('1. Trying to scan invalid QR code...');
  try {
    const response = await fetch(
      `${API_BASE_URL}/bookings/${bookingId}/scan-start-qr`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CUSTOMER_TOKEN}`
        },
        body: JSON.stringify({
          qrCode: 'INVALID-QR-CODE',
          termsAccepted: true
        })
      }
    );
    const data = await response.json();
    console.log('Error (expected):', data.error.message);
    console.log('Status:', response.status, '\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
  
  // Example 2: Terms not accepted
  console.log('2. Trying to start service without accepting terms...');
  try {
    const startQR = await generateStartQR(bookingId, WORKER_TOKEN);
    const response = await fetch(
      `${API_BASE_URL}/bookings/${bookingId}/scan-start-qr`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CUSTOMER_TOKEN}`
        },
        body: JSON.stringify({
          qrCode: startQR.qrCode,
          termsAccepted: false
        })
      }
    );
    const data = await response.json();
    console.log('Error (expected):', data.error.message);
    console.log('Status:', response.status, '\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
  
  // Example 3: Invalid photo type
  console.log('3. Trying to upload photo with invalid type...');
  try {
    const response = await fetch(
      `${API_BASE_URL}/bookings/${bookingId}/upload-photo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WORKER_TOKEN}`
        },
        body: JSON.stringify({
          photoUrl: 'https://storage.example.com/photo.jpg',
          type: 'invalid-type',
          notes: 'Test photo'
        })
      }
    );
    const data = await response.json();
    console.log('Error (expected):', data.errors);
    console.log('Status:', response.status, '\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
  
  console.log('====== ERROR HANDLING EXAMPLES COMPLETED ======\n');
}

// ==================== RUN EXAMPLES ====================

// Uncomment the example you want to run:

// completeServiceWorkflow();
// overtimeScenarioExample();
// workDocumentationExample();
// errorHandlingExamples();

// ==================== EXPORT FOR TESTING ====================

export {
    completeServiceWorkflow, errorHandlingExamples, generateEndQR, generateStartQR, overtimeScenarioExample, scanEndQR, scanStartQR, uploadPhoto, workDocumentationExample
};

