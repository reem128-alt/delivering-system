# Order Lifecycle Documentation

This document outlines the complete order flow from creation to delivery, including payment processing.

## Order Status Flow

### 1. Order Creation
**Status:** `CREATED`

```graphql
mutation {
  createOrder(createOrderDto: {
    userId: 1
    price: 25.50
    estimatedEta: 30
  }) {
    id
    status  # CREATED
    userId
    price
  }
}
```

### 2. Payment Authorization
**Status:** `PAYMENT_AUTHORIZED`

#### Frontend Card Tokenization (Secure Approach)
**Important**: Card details should NEVER be sent to the backend. Use Stripe Elements on the frontend to securely tokenize cards.

**Frontend Flow:**
1. **Stripe Elements** collects card details securely
2. **Stripe.js** creates payment method (`pm_xxx`)
3. **Frontend** sends `paymentMethodId` to backend

#### Backend Payment Creation
```graphql
mutation {
  createPayment(createPaymentDto: {
    orderId: 1
    amount: 25.50
    currency: "USD"
    provider: "stripe"
    paymentMethodId: "pm_test_visa"  # From frontend Stripe Elements
  }) {
    id
    status  # PENDING
    providerTxId
    clientSecret  # For frontend payment confirmation
    paymentMethod
  }
}
```

#### Authorize Payment
```graphql
mutation {
  authorizePayment(paymentId: "payment_id", authorizePaymentDto: {
    paymentMethodId: "pm_test_visa"  # Same payment method ID
  }) {
    id
    status  # AUTHORIZED
    authorizationId
  }
}
```

### 3. Order Status Update to SEARCHING_DRIVER
**Status:** `SEARCHING_DRIVER`

```graphql
mutation {
  updateOrderStatus(input: {
    orderId: 1
    status: SEARCHING_DRIVER
  }) {
    id
    status  # SEARCHING_DRIVER
  }
}
```

### 4. Driver Accepts Order
**Status:** `DRIVER_ASSIGNED`

```graphql
mutation {
  acceptOrder(input: {
    orderId: 1
    driverId: 1
  }) {
    id
    status  # DRIVER_ASSIGNED
    driverId
  }
}
```

### 5. Order In Progress
**Status:** `IN_PROGRESS`

```graphql
mutation {
  updateOrderStatus(input: {
    orderId: 1
    status: IN_PROGRESS
  }) {
    id
    status  # IN_PROGRESS
  }
}
```

### 6. Order Delivered
**Status:** `DELIVERED`

```graphql
mutation {
  updateOrderStatus(input: {
    orderId: 1
    status: DELIVERED
  }) {
    id
    status  # DELIVERED
  }
}
```

### 7. Payment Capture
**Payment Status:** `CAPTURED`

```graphql
mutation {
  capturePayment(paymentId: "payment_id", capturePaymentDto: {
    amount: 25.50
  }) {
    id
    status  # CAPTURED
    captureAmount
    capturedAt
  }
}
```

### 8. Final Order Status
**Status:** `PAID`

```graphql
mutation {
  updateOrderStatus(input: {
    orderId: 1
    status: PAID
  }) {
    id
    status  # PAID
  }
}
```

## Complete Status Flow Summary

### Order Status Transitions:
1. **CREATED** → Order created
2. **PAYMENT_AUTHORIZED** → Payment authorized (can happen before or after driver assignment)
3. **SEARCHING_DRIVER** → Looking for available drivers
4. **DRIVER_ASSIGNED** → Driver accepted the order
5. **IN_PROGRESS** → Driver is delivering
6. **DELIVERED** → Order completed
7. **PAID** → Payment captured and order fully paid

### Payment Status Transitions:
1. **PENDING** → Payment intent created
2. **AUTHORIZED** → Payment confirmed/authorized
3. **CAPTURED** → Funds captured
4. **REFUNDED** → If refund is processed

## Valid Status Transitions

The system validates the following status transitions:

### Order Status Valid Transitions:
- `CREATED` → `SEARCHING_DRIVER`, `CANCELED`
- `PRICE_ESTIMATED` → `SEARCHING_DRIVER`, `CANCELED`
- `PAYMENT_AUTHORIZED` → `SEARCHING_DRIVER`, `CANCELED`
- `SEARCHING_DRIVER` → `DRIVER_ASSIGNED`, `CANCELED`
- `DRIVER_ASSIGNED` → `IN_PROGRESS`, `CANCELED`
- `IN_PROGRESS` → `DELIVERED`, `CANCELED`
- `DELIVERED` → `PAID`
- `PAID` → Final state
- `CANCELED` → Final state

### Payment Status Valid Transitions:
- `PENDING` → `AUTHORIZED`, `FAILED`
- `AUTHORIZED` → `CAPTURED`, `REFUNDED`, `FAILED`
- `CAPTURED` → `REFUNDED`
- `REFUNDED` → Final state
- `FAILED` → Final state

## Important Notes

### Security Best Practices
- **NEVER send raw card details** to your backend
- **Always use Stripe Elements** for card collection
- **Frontend handles tokenization** - backend only receives `paymentMethodId`
- **PCI Compliance** - Your backend never touches sensitive card data

### Payment Timing & Flow
- **Frontend tokenizes cards** using Stripe Elements
- **Backend receives `paymentMethodId`** (secure token)
- **Client secret is returned** for frontend payment confirmation
- Payment can be authorized **before** or **after** driver assignment
- Payment capture happens **after** delivery
- The system includes fallback mechanisms for status updates

### Payment Method Creation Process
1. **Frontend**: Stripe Elements → **Stripe API** → **Payment Method ID** (`pm_xxx`)
2. **Backend**: Payment Method ID → **Payment Intent** → **Client Secret** (`pi_xxx_secret_xxx`)
3. **Frontend**: Client Secret → **Stripe.js** → **Payment Confirmation**

### Required Fields
- **`paymentMethodId`** is **required** (from frontend Stripe Elements)
- **Backend validates** payment method exists before creating payment intent

### Error Handling
- Each status transition has validation rules to prevent invalid state changes
- The system throws appropriate exceptions for invalid transitions
- Database constraints ensure data integrity

### Automatic Transitions
- Orders automatically transition from `CREATED` to `SEARCHING_DRIVER` after a short delay (fallback mechanism)
- This ensures orders can be accepted even if event system fails

### Refunds
```graphql
mutation {
  refundPayment(paymentId: "payment_id", refundPaymentDto: {
    amount: 25.50
    reason: "Customer request"
  }) {
    id
    status  # REFUNDED
    refundAmount
    refundedAt
  }
}
```

## Testing the Flow

To test the complete flow:

### For Testing Without Frontend
Use Stripe's test payment method IDs directly:
- **Visa Test**: `pm_card_visa`
- **Mastercard Test**: `pm_card_mastercard`
- **Amex Test**: `pm_card_amex`

### Test Payment Creation
```graphql
mutation {
  createPayment(createPaymentDto: {
    orderId: 1
    amount: 25.50
    currency: "USD"
    provider: "stripe"
    paymentMethodId: "pm_card_visa"  # Stripe test payment method
  }) {
    id
    status
    paymentMethod
    clientSecret
  }
}
```

### Complete Testing Steps
1. **Create a user account**
2. **Create an order**
3. **Create payment** using test payment method ID
4. **Update order status** to `SEARCHING_DRIVER`
5. **Accept order** with a driver
6. **Update status** through `IN_PROGRESS` → `DELIVERED` → `PAID`
7. **Capture payment**

### Production Implementation
In production, your frontend should:
1. **Integrate Stripe Elements** for secure card collection
2. **Create payment methods** using `stripe.createPaymentMethod()`
3. **Send `paymentMethodId`** to backend for payment processing
4. **Use `clientSecret`** to confirm payment on frontend

Each step must be completed in order for the flow to work correctly.
