//Notification Testing Script
// Run with: node notification-test.js

const io = require('socket.io-client');

// Test WebSocket notifications
function testWebSocketNotifications() {
  console.log('🧪 Testing WebSocket Notifications...\n');
  
  // Connect as a driver
  const driverSocket = io('http://localhost:3000/notifications', {
    auth: {
      token: 'your_driver_jwt_token_here'
    }
  });

  driverSocket.on('connect', () => {
    console.log('✅ Driver connected');
    
    // Join driver room
    driverSocket.emit('join:driver', { driverId: 1 });
  });

  driverSocket.on('notification:new', (data) => {
    console.log('🔔 Driver received notification:', data);
  });

  driverSocket.on('order:created', (data) => {
    console.log('📦 Driver received new order:', data);
  });

  // Connect as customer
  const customerSocket = io('http://localhost:3000/notifications', {
    auth: {
      token: 'your_customer_jwt_token_here'
    }
  });

  customerSocket.on('connect', () => {
    console.log('✅ Customer connected');
  });

  customerSocket.on('notification:new', (data) => {
    console.log('🔔 Customer received notification:', data);
  });

  return { driverSocket, customerSocket };
}

// Test GraphQL mutations
async function testOrderCreation() {
  console.log('\n🧪 Testing Order Creation...\n');
  
  const mutation = `
    mutation CreateOrder {
      createOrder(input: {
        userId: 1
        pickupLat: 30.0444
        pickupLng: 31.2357
        dropoffLat: 30.0166
        dropoffLng: 31.4333
        price: 320.0
        status: CREATED
      }) {
        id
        userId
        status
        price
        estimatedEta
      }
    }
  `;

  try {
    const response = await fetch('http://localhost:3000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your_jwt_token_here'
      },
      body: JSON.stringify({ query: mutation })
    });

    const result = await response.json();
    console.log('📦 Order created:', result);
  } catch (error) {
    console.error('❌ Order creation failed:', error);
  }
}

// Test Redis Pub/Sub
function testRedisNotifications() {
  console.log('\n🧪 Testing Redis Notifications...\n');
  
  // This would require Redis client setup
  // For now, just check logs in your terminal
  console.log('📋 Check your terminal for Redis messages:');
  console.log('   - "Order #X created, finding nearest drivers..."');
  console.log('   - "Found X drivers for order #X"');
  console.log('   - "Order #X set to PENDING_ACCEPTANCE"');
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Notification Tests...\n');
  
  // Test 1: WebSocket connections
  const sockets = testWebSocketNotifications();
  
  // Wait a bit for connections
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Order creation (triggers notifications)
  await testOrderCreation();
  
  // Test 3: Redis logs
  testRedisNotifications();
  
  console.log('\n✅ Tests completed! Check:');
  console.log('   1. Browser console for WebSocket messages');
  console.log('   2. Terminal for Redis and notification logs');
  console.log('   3. Postman/cURL for push notification tests');
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testWebSocketNotifications,
  testOrderCreation,
  testRedisNotifications
};
