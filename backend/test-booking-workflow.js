/**
 * Test Script for Booking Workflow
 * Tests that bookings appear correctly in customer's upcoming tasks
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:5000/api';

// Test Configuration
const testConfig = {
  customerEmail: 'customer@test.com',
  customerPassword: 'password123',
  workerEmail: 'worker@test.com',
  workerPassword: 'password123'
};

let customerToken = null;
let workerToken = null;
let testBookingId = null;

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.token && { 'Authorization': `Bearer ${options.token}` }),
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error(`API Error (${response.status}):`, data);
    throw new Error(data.error?.message || 'API call failed');
  }
  
  return data;
}

// Test Functions

async function loginCustomer() {
  console.log('\n1️⃣ Logging in as customer...');
  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testConfig.customerEmail,
        password: testConfig.customerPassword
      })
    });
    customerToken = data.token;
    console.log('✅ Customer logged in successfully');
    console.log('   Customer ID:', data.user._id);
    return data.user;
  } catch (error) {
    console.error('❌ Customer login failed:', error.message);
    throw error;
  }
}

async function loginWorker() {
  console.log('\n2️⃣ Logging in as worker...');
  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testConfig.workerEmail,
        password: testConfig.workerPassword
      })
    });
    workerToken = data.token;
    console.log('✅ Worker logged in successfully');
    console.log('   Worker ID:', data.user._id);
    return data.user;
  } catch (error) {
    console.error('❌ Worker login failed:', error.message);
    throw error;
  }
}

async function getAvailableService() {
  console.log('\n3️⃣ Getting available service...');
  try {
    const data = await apiCall('/services', { token: customerToken });
    const service = data.services?.[0];
    if (!service) {
      throw new Error('No services available');
    }
    console.log('✅ Found service:', service.name);
    console.log('   Service ID:', service._id);
    console.log('   Price:', service.price);
    return service;
  } catch (error) {
    console.error('❌ Failed to get service:', error.message);
    throw error;
  }
}

async function createBooking(service) {
  console.log('\n4️⃣ Creating a new booking...');
  try {
    // Create booking for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingDate = tomorrow.toISOString().split('T')[0];
    
    const bookingData = {
      service: service._id,
      bookingDate: bookingDate,
      startTime: '10:00',
      endTime: '12:00',
      totalAmount: service.price || 500,
      location: {
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345'
      },
      notes: 'Test booking for workflow verification',
      autoAssign: true
    };
    
    const data = await apiCall('/bookings', {
      method: 'POST',
      token: customerToken,
      body: JSON.stringify(bookingData)
    });
    
    testBookingId = data.booking._id;
    console.log('✅ Booking created successfully');
    console.log('   Booking ID:', testBookingId);
    console.log('   Status:', data.booking.status);
    console.log('   Worker:', data.booking.worker ? data.booking.worker.name : 'Not assigned yet');
    console.log('   Date:', bookingDate);
    console.log('   Time:', bookingData.startTime, '-', bookingData.endTime);
    return data.booking;
  } catch (error) {
    console.error('❌ Failed to create booking:', error.message);
    throw error;
  }
}

async function checkCustomerUpcomingBookings() {
  console.log('\n5️⃣ Checking customer\'s upcoming bookings...');
  try {
    // Test with multiple status values (pending,confirmed)
    const data = await apiCall('/bookings?status=pending,confirmed', {
      token: customerToken
    });
    
    console.log('✅ Retrieved bookings successfully');
    console.log('   Total bookings:', data.totalBookings);
    console.log('   Bookings returned:', data.bookings.length);
    
    if (data.bookings.length > 0) {
      console.log('\n   📋 Bookings:');
      data.bookings.forEach((booking, index) => {
        console.log(`   ${index + 1}. ${booking.service?.name || 'Unknown Service'}`);
        console.log(`      Status: ${booking.status}`);
        console.log(`      Worker: ${booking.worker?.name || 'Not assigned'}`);
        console.log(`      Date: ${booking.bookingDate}`);
        console.log('');
      });
      
      // Check if our test booking is in the list
      const foundTestBooking = data.bookings.find(b => b._id === testBookingId);
      if (foundTestBooking) {
        console.log('   ✅ Test booking FOUND in upcoming bookings!');
        return true;
      } else {
        console.log('   ⚠️ Test booking NOT found in upcoming bookings');
        return false;
      }
    } else {
      console.log('   ⚠️ No upcoming bookings found');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to get upcoming bookings:', error.message);
    throw error;
  }
}

async function checkBookingById() {
  console.log('\n6️⃣ Verifying booking by ID...');
  try {
    const data = await apiCall(`/bookings/${testBookingId}`, {
      token: customerToken
    });
    
    console.log('✅ Booking retrieved by ID');
    console.log('   Status:', data.booking.status);
    console.log('   Service:', data.booking.service.name);
    console.log('   Worker:', data.booking.worker?.name || 'Not assigned');
    console.log('   Customer:', data.booking.customer.name);
    return data.booking;
  } catch (error) {
    console.error('❌ Failed to get booking by ID:', error.message);
    throw error;
  }
}

async function testAllBookingStatuses() {
  console.log('\n7️⃣ Testing all status filters...');
  
  const statuses = [
    'pending',
    'confirmed',
    'pending,confirmed',
    'in-progress',
    'completed',
    'cancelled'
  ];
  
  for (const status of statuses) {
    try {
      const data = await apiCall(`/bookings?status=${status}`, {
        token: customerToken
      });
      console.log(`   ${status.padEnd(20)} → ${data.bookings.length} booking(s)`);
    } catch (error) {
      console.log(`   ${status.padEnd(20)} → Error: ${error.message}`);
    }
  }
}

// Main Test Runner
async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   BOOKING WORKFLOW TEST');
  console.log('   Testing: Customer can see bookings in upcoming tasks');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Step 1 & 2: Login
    const customer = await loginCustomer();
    const worker = await loginWorker();
    
    // Step 3: Get service
    const service = await getAvailableService();
    
    // Step 4: Create booking
    const booking = await createBooking(service);
    
    // Step 5: Check if booking appears in upcoming
    const bookingFoundInUpcoming = await checkCustomerUpcomingBookings();
    
    // Step 6: Verify booking by ID
    await checkBookingById();
    
    // Step 7: Test all status filters
    await testAllBookingStatuses();
    
    // Final Result
    console.log('\n═══════════════════════════════════════════════════════');
    if (bookingFoundInUpcoming) {
      console.log('   ✅ TEST PASSED: Booking appears in upcoming tasks');
    } else {
      console.log('   ❌ TEST FAILED: Booking not appearing in upcoming tasks');
    }
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   ❌ TEST FAILED WITH ERROR');
    console.log('   Error:', error.message);
    console.log('═══════════════════════════════════════════════════════\n');
  }
}

// Run the tests
runTests();
