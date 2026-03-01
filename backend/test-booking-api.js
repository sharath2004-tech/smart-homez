/**
 * API Test: Booking Creation with Location Validation
 * 
 * This script tests the POST /api/bookings endpoint
 * Run this with your server running on http://localhost:5000
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

// Test credentials (update these with real values from your database)
const TEST_USER = {
  email: 'test@example.com', // Update with a real customer email
  password: 'password123'
};

let authToken = '';
let serviceId = '';

async function login() {
  console.log('🔐 Logging in...\n');
  
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });

    const data = await response.json();
    
    if (data.token) {
      authToken = data.token;
      console.log('✅ Login successful\n');
      return true;
    } else {
      console.log('❌ Login failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

async function getService() {
  console.log('📋 Fetching available services...\n');
  
  try {
    const response = await fetch(`${API_URL}/services?limit=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await response.json();
    
    if (data.services && data.services.length > 0) {
      serviceId = data.services[0]._id;
      console.log(`✅ Found service: ${data.services[0].name}\n`);
      return true;
    } else {
      console.log('❌ No services found\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Error fetching services:', error.message);
    return false;
  }
}

async function testBookingCreation(testCase, bookingData) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`TEST: ${testCase}`);
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📝 Request Data:');
  console.log(JSON.stringify(bookingData, null, 2));
  console.log('');

  try {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(bookingData)
    });

    const data = await response.json();

    console.log(`📊 Response Status: ${response.status}`);
    console.log('📊 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Request succeeded\n');
      return { success: true, data };
    } else {
      console.log(`❌ Request failed: ${data.error?.message || data.message}\n`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('❌ Request error:', error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n🧪 API BOOKING VALIDATION TEST SUITE\n');
  console.log('This tests the POST /api/bookings endpoint\n');

  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('⚠️  Cannot proceed without authentication. Please update TEST_USER credentials.\n');
    return;
  }

  // Get a service
  const serviceSuccess = await getService();
  if (!serviceSuccess) {
    console.log('⚠️  Cannot proceed without a service.\n');
    return;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookingDate = tomorrow.toISOString().split('T')[0];

  // ==============================================
  // TEST 1: Valid booking with proper coordinates
  // ==============================================
  await testBookingCreation(
    'VALID BOOKING - With Valid Coordinates',
    {
      service: serviceId,
      bookingDate,
      startTime: '10:00',
      endTime: '11:00',
      totalAmount: 500,
      location: {
        coordinates: [72.8777, 19.0760], // Mumbai coordinates
        address: 'Test Address, Mumbai',
        area: 'Andheri',
        city: 'Mumbai'
      },
      autoAssign: true
    }
  );

  // ==============================================
  // TEST 2: Invalid - NULL coordinates
  // ==============================================
  await testBookingCreation(
    'INVALID BOOKING - NULL Coordinates',
    {
      service: serviceId,
      bookingDate,
      startTime: '12:00',
      endTime: '13:00',
      totalAmount: 500,
      location: {
        coordinates: [null, null], // INVALID
        address: 'Test Address'
      }
    }
  );

  // ==============================================
  // TEST 3: Invalid - Missing coordinates
  // ==============================================
  await testBookingCreation(
    'INVALID BOOKING - Missing Coordinates',
    {
      service: serviceId,
      bookingDate,
      startTime: '14:00',
      endTime: '15:00',
      totalAmount: 500,
      location: {
        address: 'Test Address'
        // coordinates missing
      }
    }
  );

  // ==============================================
  // TEST 4: Invalid - Out of range coordinates
  // ==============================================
  await testBookingCreation(
    'INVALID BOOKING - Out of Range Coordinates',
    {
      service: serviceId,
      bookingDate,
      startTime: '16:00',
      endTime: '17:00',
      totalAmount: 500,
      location: {
        coordinates: [200, 100], // Invalid: out of range
        address: 'Test Address'
      }
    }
  );

  // ==============================================
  // TEST 5: Invalid - Empty coordinates
  // ==============================================
  await testBookingCreation(
    'INVALID BOOKING - Empty Coordinates Array',
    {
      service: serviceId,
      bookingDate,
      startTime: '18:00',
      endTime: '19:00',
      totalAmount: 500,
      location: {
        coordinates: [], // Invalid: empty array
        address: 'Test Address'
      }
    }
  );

  // ==============================================
  // TEST 6: No location provided
  // ==============================================
  await testBookingCreation(
    'INVALID BOOKING - No Location',
    {
      service: serviceId,
      bookingDate,
      startTime: '20:00',
      endTime: '21:00',
      totalAmount: 500
      // location missing entirely
    }
  );

  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST SUITE COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Expected Results:');
  console.log('  ✅ Test 1 should succeed (or fail with SERVICE_NOT_AVAILABLE_IN_AREA)');
  console.log('  ❌ Test 2 should fail with INVALID_COORDINATES');
  console.log('  ❌ Test 3 should fail with LOCATION_REQUIRED');
  console.log('  ❌ Test 4 should fail with INVALID_COORDINATES');
  console.log('  ❌ Test 5 should fail with LOCATION_REQUIRED');
  console.log('  ❌ Test 6 should fail with LOCATION_REQUIRED\n');
}

// Run the tests
runTests().catch(console.error);
