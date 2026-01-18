# Order & Driver Testing Examples

This directory contains examples for testing order creation and nearest driver assignment functionality.

## 📁 Files Created

### 1. `order-mutations-example.graphql`
- **Purpose**: GraphQL mutation examples
- **Contains**: Complete GraphQL mutations for creating drivers, orders, and finding nearest drivers
- **Usage**: Copy-paste into GraphQL Playground or Apollo Studio

### 2. `order-resolver-example.ts`
- **Purpose**: NestJS GraphQL resolver implementation
- **Contains**: Complete resolver code with distance calculation and auto-assignment logic
- **Usage**: Reference for implementing your own resolvers

### 3. `websocket-test.html`
- **Purpose**: WebSocket notification testing interface
- **Contains**: HTML page for testing real-time notifications without frontend
- **Usage**: Open in browser to test WebSocket connections and notifications

### 4. `notification-test.js`
- **Purpose**: Node.js script for notification testing
- **Contains**: Automated tests for WebSocket and notification systems
- **Usage**: Run with `node notification-test.js`

---

## 🧪 Testing Notifications Without Frontend

### Method 1: HTML Test Page (Recommended)
1. **Install Live Server extension** in VS Code
2. Right-click `websocket-test.html` → "Open with Live Server"
3. Enter JWT token and test notifications

### Method 2: Browser Console
1. Open browser console (F12)
2. Type `allow pasting` and press Enter (to bypass security warning)
3. Paste WebSocket connection code

### Method 3: Direct File Access
```bash
# Option A: Use Python's built-in server
cd d:/work/delivering/backend/delivering/src/test
python -m http.server 8080
# Then open: http://localhost:8080/websocket-test.html

# Option B: Use Node.js server
npx serve d:/work/delivering/backend/delivering/src/test
# Then open: http://localhost:3000/websocket-test.html
```

---

## 🚀 Quick Testing Guide

### Step 1: Get JWT Tokens
```graphql
# Login as driver
mutation LoginDriver {
  login(input: {
    email: "ahmed.driver@example.com"
    password: "password123"
  }) {
    token user { id name role }
  }
}

# Login as customer  
mutation LoginCustomer {
  login(input: {
    email: "john.customer@example.com"
    password: "password123"
  }) {
    token user { id name role }
  }
}
```

### Step 2: Test WebSocket Connection
1. Open `websocket-test.html` in browser
2. Enter driver JWT token
3. Click "Connect"
4. You should see "✅ Connected" status

### Step 3: Create Order & Trigger Notifications
```graphql
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
    id userId status price estimatedEta
  }
}
```

### Step 4: Watch for Notifications
- **Browser Console**: WebSocket messages
- **Terminal**: Redis and notification logs
- **HTML Page**: Real-time notification display

---

## 📱 What You'll See

### WebSocket Events
```javascript
// Driver receives new order notification
{
  "type": "ORDER_CREATED",
  "title": "New Order Available",
  "message": "Order #1 is 0.5km away. Accept now!",
  "data": {
    "orderId": "1",
    "driverId": "1",
    "distance": "500"
  }
}
```

### Terminal Logs
```
[Nest] INFO [DriversService] Order #1 created, finding nearest drivers...
[Nest] INFO [DriversService] Found 2 drivers for order #1: Driver #1 (500m), Driver #2 (1200m)
[Nest] INFO [DriversService] Order #1 set to PENDING_ACCEPTANCE, notifying drivers...
[Nest] INFO [NotificationsService] Sending notification to user 2: New Order Available
```

---

## 📍 Test Locations (Cairo, Egypt)

| Location | Latitude | Longitude | Description |
|----------|----------|-----------|-------------|
| Cairo Center | 30.0444 | 31.2357 | Downtown Cairo |
| Nasr City | 30.0166 | 31.4333 | Eastern Cairo |
| Maadi | 29.9591 | 31.2562 | Southern Cairo |
| Heliopolis | 30.1228 | 31.3378 | Northeastern Cairo |
| Giza Pyramids | 29.9792 | 31.1342 | Giza Area |

---

## 🔄 Complete Test Workflow

1. **Create drivers** at different Cairo locations
2. **Connect to WebSocket** as driver using HTML test page
3. **Create order** from Cairo Center
4. **Watch notifications** arrive in real-time
5. **Check terminal** for driver search and assignment logs
6. **Verify order status** changes from CREATED → PENDING_ACCEPTANCE

---

## 💡 Key Features Tested

### ✅ Real-time WebSocket Notifications
- Driver receives new order alerts
- Customer gets status updates
- Instant connection/disconnection events

### ✅ Distance-based Driver Assignment
- Finds nearest available drivers
- Calculates accurate distances using PostGIS
- Auto-assigns closest driver

### ✅ Notification System Integration
- WebSocket for real-time delivery
- Redis Pub/Sub for cross-server communication
- FCM push notifications (if configured)

### ✅ Event-driven Architecture
- Order creation triggers driver search
- Automatic notification dispatch
- Status updates propagate to all connected clients

---

## 🛠️ Troubleshooting

### WebSocket Connection Issues
- **Check JWT token**: Ensure it's valid and not expired
- **Verify server running**: Make sure NestJS app is running on port 3000
- **Check CORS**: Ensure WebSocket CORS is configured correctly

### Notification Not Received
- **Check driver status**: Driver must be AVAILABLE to receive notifications
- **Verify distance**: Driver must be within search radius (default 10km)
- **Check Redis**: Ensure Redis is running and accessible

### HTML File Not Accessible
- **Use Live Server**: Install VS Code Live Server extension
- **Use Python server**: `python -m http.server 8080`
- **Use Node.js server**: `npx serve .`

---

## 🎯 Expected Results

When you run the complete test workflow:

1. **Driver at Cairo Center** gets assigned first (closest location)
2. **WebSocket notification** appears instantly in browser
3. **Terminal shows** driver search and assignment process
4. **Order status** updates to PENDING_ACCEPTANCE
5. **Multiple drivers** can be connected to test notification broadcasting

This demonstrates the complete **real-time notification system** with location-based driver assignment! 🚀
