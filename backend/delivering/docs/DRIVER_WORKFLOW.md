# 🚗 Driver Workflow - Complete Guide

## Overview
This document explains the complete workflow for drivers from receiving notifications to completing orders.

---

## 📱 Step 1: Driver Receives Notification

### When Order is Created
When a customer creates an order, the system:

1. **Finds Nearby Drivers** (within 10km radius)
2. **Sends Notifications** to all available drivers
3. **Stores in Database** if driver is offline

### Notification Content
```json
{
  "id": 123,
  "type": "order_created",
  "title": "New Order Available",
  "message": "Order #16 is 0.5km away. Accept now!",
  "data": {
    "orderId": "16",
    "driverId": "2",
    "distance": "500"
  },
  "timestamp": "2026-01-09T23:13:03.000Z"
}
```

### How Driver Receives It

**If Driver is ONLINE:**
- ✅ Real-time via WebSocket
- ✅ Push notification via FCM (Firebase)
- ✅ Stored in database

**If Driver is OFFLINE:**
- ✅ Stored in database
- ✅ Push notification via FCM (if token exists)
- ⏳ Retrieved when driver comes back online

---

## ✅ Step 2: Driver Accepts Order

### GraphQL Mutation
```graphql
mutation AcceptOrder {
  acceptOrder(input: {
    orderId: 16
    driverId: 2
  }) {
    id
    userId
    driverId
    status
    price
    estimatedEta
  }
}
```

### What Happens Backend

**Validations:**
1. ✅ Order exists
2. ✅ Order status is `PENDING_ACCEPTANCE`
3. ✅ Order not already accepted by another driver
4. ✅ Driver exists and status is `AVAILABLE`

**Atomic Transaction:**
```typescript
// 1. Update Order
order.status = ASSIGNED
order.driverId = 2

// 2. Update Driver
driver.status = BUSY

// 3. Notify Customer
notification: "Your order has been accepted by a driver"
```

**Response:**
```json
{
  "data": {
    "acceptOrder": {
      "id": 16,
      "userId": 1,
      "driverId": 2,
      "status": "ASSIGNED",
      "price": 320.0,
      "estimatedEta": 25
    }
  }
}
```

---

## 🚗 Step 3: Driver Updates Order Status

As the driver progresses through the delivery, they update the order status:

### Status Flow
```
CREATED → PENDING_ACCEPTANCE → ASSIGNED → PICKED_UP → ON_THE_WAY → DELIVERED
```

### Update Status Mutation
```graphql
mutation UpdateOrderStatus {
  updateOrderStatus(input: {
    orderId: 16
    status: PICKED_UP
  }) {
    id
    status
  }
}
```

### Valid Status Transitions

| Current Status | Allowed Next Status |
|----------------|---------------------|
| `CREATED` | `PENDING_ACCEPTANCE`, `CANCELED` |
| `PENDING_ACCEPTANCE` | `ASSIGNED`, `CANCELED` |
| `ASSIGNED` | `PICKED_UP`, `CANCELED` |
| `PICKED_UP` | `ON_THE_WAY`, `DELIVERED`, `CANCELED` |
| `ON_THE_WAY` | `DELIVERED`, `CANCELED` |
| `DELIVERED` | *(final state)* |
| `CANCELED` | *(final state)* |

**Note:** Drivers can skip `ON_THE_WAY` and go directly from `PICKED_UP` to `DELIVERED` for short-distance deliveries.

---

## 📍 Step 4: Driver Updates Location (Real-time)

Drivers should continuously update their location so customers can track them.

### Update Location Mutation
```graphql
mutation UpdateDriverLocation {
  updateDriverLocation(input: {
    driverId: 2
    lat: 30.0444
    lng: 31.2357
  }) {
    id
    userId
    status
  }
}
```

### Best Practices
- Update location every **5-10 seconds** while on a delivery
- Stop updates when driver is `OFFLINE` or `AVAILABLE`
- Use GPS with high accuracy mode

---

## 🎯 Step 5: Complete Delivery

### Mark as Delivered
```graphql
mutation CompleteDelivery {
  updateOrderStatus(input: {
    orderId: 16
    status: DELIVERED
  }) {
    id
    status
  }
}
```

### What Happens
1. **Order status** → `DELIVERED`
2. **Driver status** → `AVAILABLE` (ready for next order)
3. **Customer notified** → "Your order has been delivered"

---

## 🔔 Notification Types Drivers Receive

| Type | When | Priority |
|------|------|----------|
| `ORDER_CREATED` | New order available nearby | HIGH |
| `ORDER_CANCELLED` | Customer cancelled order | NORMAL |
| `PAYMENT_RECEIVED` | Payment confirmed | NORMAL |

---

## 📊 Query Available Orders

### Get Pending Orders
```graphql
query GetPendingOrders {
  pendingOrders {
    id
    userId
    status
    price
    estimatedEta
    createdAt
  }
}
```

Returns all orders with status `PENDING_ACCEPTANCE` that drivers can accept.

---

## 🛠️ Driver Status Management

### Available Statuses
- `OFFLINE` - Driver not working
- `AVAILABLE` - Driver online and ready for orders
- `BUSY` - Driver has an active order

### Update Driver Status
```graphql
mutation UpdateDriverStatus {
  updateDriverStatus(input: {
    driverId: 2
    status: AVAILABLE
  }) {
    id
    status
  }
}
```

### Status Rules
- Driver must be `AVAILABLE` to receive new order notifications
- Status automatically changes to `BUSY` when accepting an order
- Status should return to `AVAILABLE` after completing delivery

---

## 🧪 Testing the Workflow

### 1. Setup Driver
```graphql
# Login as driver
mutation Login {
  login(input: {
    email: "driver@example.com"
    password: "password123"
  }) {
    token
    user {
      id
      email
      role
    }
  }
}
```

### 2. Connect WebSocket
```javascript
const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('notification:new', (data) => {
  console.log('New order notification:', data);
  // Show notification to driver
  // Driver can accept or ignore
});
```

### 3. Test Offline Notifications
```graphql
# Query stored notifications
query GetMyNotifications {
  userNotifications(userId: 4) {
    id
    type
    title
    message
    isRead
    createdAt
    data
  }
}
```

---

## 🚨 Error Handling

### Common Errors

**Order Already Accepted**
```json
{
  "errors": [{
    "message": "Order #16 already accepted by another driver",
    "extensions": { "code": "CONFLICT" }
  }]
}
```

**Driver Not Available**
```json
{
  "errors": [{
    "message": "Driver #2 is not available (status: BUSY)",
    "extensions": { "code": "CONFLICT" }
  }]
}
```

**Invalid Status Transition**
```json
{
  "errors": [{
    "message": "Cannot transition from DELIVERED to PICKED_UP",
    "extensions": { "code": "BAD_REQUEST" }
  }]
}
```

---

## 📱 Mobile App Integration

### Recommended Flow

1. **App Startup**
   - Login driver
   - Connect WebSocket
   - Set status to `AVAILABLE`
   - Start location updates

2. **Receive Notification**
   - Show push notification
   - Play sound/vibration
   - Display order details
   - Show "Accept" button

3. **Accept Order**
   - Call `acceptOrder` mutation
   - Navigate to order details screen
   - Show pickup location on map
   - Start navigation

4. **During Delivery**
   - Update location every 5-10 seconds
   - Update status at each milestone
   - Show customer contact info

5. **Complete Delivery**
   - Mark as `DELIVERED`
   - Return to available orders screen
   - Status automatically returns to `AVAILABLE`

---

## 🔐 Security Notes

- All mutations require JWT authentication
- Driver can only accept orders when status is `AVAILABLE`
- Driver can only update their own location
- Order acceptance is atomic (prevents race conditions)

---

## 📈 Performance Tips

- Use WebSocket for real-time updates (don't poll)
- Batch location updates if network is slow
- Cache pending orders locally
- Use optimistic UI updates for better UX
