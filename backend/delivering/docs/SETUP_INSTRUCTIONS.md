# Hybrid Notification System - Setup Instructions

## 🚀 Quick Start Guide

This guide will help you set up and run the hybrid notification system (WebSocket + Firebase + Redis) for your delivery application.

---

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher with PostGIS extension)
- Redis (v7 or higher)
- Firebase project with Cloud Messaging enabled

---

## 🔧 Installation Steps

### 1. Install Dependencies

The required packages have already been installed:
- `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`
- `firebase-admin`
- `ioredis`
- `@nestjs/bull`, `bull`
- `@nestjs/config`

If you need to reinstall:
```bash
npm install
```

### 2. Set Up Redis

**Option A: Using Docker (Recommended for Development)**
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

**Option B: Install Locally**
- Windows: Download from https://github.com/microsoftarchive/redis/releases
- Mac: `brew install redis && brew services start redis`
- Linux: `sudo apt-get install redis-server && sudo systemctl start redis`

**Verify Redis is Running:**
```bash
redis-cli ping
# Should return: PONG
```

### 3. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Navigate to **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Save the JSON file as `firebase-admin-sdk.json`
6. Create config directory and move the file:
   ```bash
   mkdir -p src/config
   move firebase-admin-sdk.json src/config/
   ```

### 4. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Update `.env` with your values:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/delivering?schema=public"

   # JWT
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_DB=0

   # Firebase
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_PRIVATE_KEY_PATH=./src/config/firebase-admin-sdk.json

   # WebSocket
   WEBSOCKET_CORS_ORIGIN=http://localhost:3000,http://localhost:3001
   SERVER_ID=server-1

   # Application
   PORT=3000
   NODE_ENV=development
   ```

### 5. Run Database Migration

Update the database schema to include the new notification fields:

```bash
npx prisma migrate dev --name add_notification_system
```

This will:
- Add `type`, `data`, `readAt`, `updatedAt` fields to Notification model
- Create indexes for better query performance
- Update the database schema

### 6. Generate Prisma Client

```bash
npx prisma generate
```

---

## 🏃 Running the Application

### Development Mode
```bash
npm run start:dev
```

The application will start on:
- **REST API**: http://localhost:3000
- **GraphQL Playground**: http://localhost:3000/graphql
- **WebSocket**: ws://localhost:3000/notifications

### Production Mode
```bash
npm run build
npm run start:prod
```

---

## 🧪 Testing the Notification System

### 1. Test WebSocket Connection

Create a test client (or use a tool like Postman WebSocket):

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000/notifications', {
  auth: {
    token: 'YOUR_JWT_TOKEN_HERE'
  }
});

socket.on('connection:established', (data) => {
  console.log('Connected:', data);
});

socket.on('notification:new', (notification) => {
  console.log('New notification:', notification);
});

// Register FCM token
socket.emit('fcm:register', {
  token: 'YOUR_FCM_TOKEN',
  platform: 'android' // or 'ios'
});
```

### 2. Test Sending Notifications

You can test notifications through your existing order flow or create a test endpoint:

```typescript
// In your controller or resolver
@Post('test-notification')
async testNotification(@Body() body: { userId: number }) {
  await this.notificationsService.sendNotification({
    userId: body.userId,
    type: NotificationType.ORDER_CREATED,
    title: 'Test Notification',
    message: 'This is a test notification',
    data: { test: 'data' },
    priority: 'high',
  });
  return { success: true };
}
```

### 3. Monitor Redis

Check Redis for active connections:
```bash
redis-cli
> KEYS ws:user:*
> GET ws:user:1
> KEYS fcm:user:*
```

### 4. Monitor Bull Queue

The Bull queue dashboard can be added with:
```bash
npm install @bull-board/express
```

---

## 📊 System Architecture Overview

### Components Created

1. **`src/redis/`**
   - `redis.service.ts` - Redis client with pub/sub, caching, and queue management
   - `redis.module.ts` - Global Redis module

2. **`src/notifications/`**
   - `notifications.service.ts` - Multi-channel notification orchestrator
   - `notifications.gateway.ts` - WebSocket gateway with Socket.IO
   - `firebase.service.ts` - Firebase Cloud Messaging integration
   - `processors/notification.processor.ts` - Bull queue processor for retries
   - `dto/send-notification.dto.ts` - DTOs and enums

3. **Updated Files**
   - `prisma/schema.prisma` - Enhanced Notification model
   - `src/app.module.ts` - Added ConfigModule, BullModule, RedisModule
   - `src/notifications/notifications.module.ts` - Complete module configuration

### Data Flow

```
Order Created
    ↓
Drivers Service finds nearby drivers
    ↓
NotificationsService.sendNotification()
    ↓
    ├─→ Check Redis: Is user online?
    │   ├─→ YES: Send via WebSocket (instant)
    │   └─→ NO: Continue to FCM
    │
    ├─→ Send via Firebase Cloud Messaging
    │
    ├─→ Store in PostgreSQL (audit/history)
    │
    └─→ Publish to Redis Pub/Sub (multi-server)
```

---

## 🔐 Security Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Enable Redis AUTH in production (`REDIS_PASSWORD`)
- [ ] Use TLS for Redis connections in production
- [ ] Restrict CORS origins (`WEBSOCKET_CORS_ORIGIN`)
- [ ] Keep `firebase-admin-sdk.json` secure (add to .gitignore)
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting on WebSocket connections
- [ ] Implement proper authentication middleware

---

## 🐛 Troubleshooting

### WebSocket Connection Fails
- **Check CORS**: Ensure client origin is in `WEBSOCKET_CORS_ORIGIN`
- **Check JWT**: Verify token is valid and not expired
- **Check Logs**: Look for authentication errors in console

### Redis Connection Error
```
Error: Redis connection failed
```
**Solution**: 
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT` in `.env`
- Check firewall settings

### Firebase Notifications Not Received
```
Error: Firebase not initialized
```
**Solution**:
- Verify `firebase-admin-sdk.json` exists at specified path
- Check `FIREBASE_PROJECT_ID` matches your Firebase project
- Ensure FCM is enabled in Firebase Console

### Prisma Migration Fails
```
Error: Column 'type' does not exist
```
**Solution**:
```bash
npx prisma migrate reset
npx prisma migrate dev --name init
```

### Package Installation Issues
```
Error: Cannot find module '@nestjs/config'
```
**Solution**:
```bash
npm install @nestjs/config
npm install
```

---

## 📱 Client Implementation

### React Native Example

```typescript
// NotificationService.ts
import io from 'socket.io-client';
import messaging from '@react-native-firebase/messaging';

class NotificationService {
  private socket: Socket;

  async initialize(token: string) {
    // Connect WebSocket
    this.socket = io('https://your-api.com/notifications', {
      auth: { token },
    });

    this.socket.on('notification:new', (data) => {
      // Show in-app notification
      console.log('New notification:', data);
    });

    // Get FCM token
    const fcmToken = await messaging().getToken();
    
    // Register with backend
    this.socket.emit('fcm:register', {
      token: fcmToken,
      platform: Platform.OS,
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('FCM message:', remoteMessage);
    });
  }
}
```

### Web (React) Example

```typescript
// useNotifications.ts
import { useEffect } from 'react';
import io from 'socket.io-client';

export const useNotifications = (token: string) => {
  useEffect(() => {
    const socket = io('https://your-api.com/notifications', {
      auth: { token },
    });

    socket.on('notification:new', (notification) => {
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/logo.png',
        });
      }
    });

    return () => socket.disconnect();
  }, [token]);
};
```

---

## 📈 Monitoring & Performance

### Key Metrics to Track

1. **WebSocket Connections**
   - Active connections: Check Redis `KEYS ws:user:*`
   - Connection duration
   - Reconnection rate

2. **Notification Delivery**
   - WebSocket delivery rate
   - FCM delivery rate
   - Failed notifications (check Bull queue)

3. **Redis Performance**
   - Memory usage: `redis-cli INFO memory`
   - Operation latency
   - Connection count

4. **Queue Status**
   - Pending jobs: Check Bull dashboard
   - Failed jobs
   - Processing time

### Logging

All services include comprehensive logging:
```typescript
// Check logs for:
[NotificationsService] Sending notification to user 123
[NotificationsGateway] Client connected: abc123 (User: 123)
[FirebaseService] FCM sent to user 123
[RedisService] Redis client connected
```

---

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL="postgresql://user:password@prod-host:5432/delivering"
REDIS_HOST=your-redis-host.com
REDIS_PASSWORD=strong-password
REDIS_TLS=true
WEBSOCKET_CORS_ORIGIN=https://yourdomain.com
JWT_SECRET=very-strong-secret-key
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: delivering
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  redis-data:
  postgres-data:
```

---

## 📚 API Reference

### NotificationsService Methods

```typescript
// Send notification to single user
await notificationsService.sendNotification({
  userId: 123,
  type: NotificationType.ORDER_CREATED,
  title: 'New Order',
  message: 'You have a new order',
  data: { orderId: '456' },
  priority: 'high',
});

// Send to multiple users
await notificationsService.sendBatchNotification(
  [123, 456, 789],
  {
    type: NotificationType.ORDER_CREATED,
    title: 'Broadcast',
    message: 'Important announcement',
  }
);

// Broadcast to all drivers
await notificationsService.broadcastToDrivers(
  'System Maintenance',
  'App will be down for 10 minutes'
);

// Get user notifications
const result = await notificationsService.getUserNotifications(
  userId,
  page,
  limit
);
```

### WebSocket Events

**Client → Server:**
- `fcm:register` - Register FCM token
- `notification:read` - Mark notification as read
- `location:update` - Update driver location

**Server → Client:**
- `connection:established` - Connection confirmed
- `notification:new` - New notification
- `notification:broadcast` - Broadcast message
- `driver:location` - Driver location update

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Redis is running and accessible
- [ ] Firebase credentials are configured
- [ ] Database migration completed successfully
- [ ] Application starts without errors
- [ ] WebSocket connections work
- [ ] Notifications are stored in database
- [ ] FCM tokens can be registered
- [ ] Bull queue is processing jobs
- [ ] Environment variables are set correctly

---

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in the console
3. Check Redis connection: `redis-cli ping`
4. Verify Firebase configuration
5. Review the full documentation in `NOTIFICATION_SYSTEM.md`

---

**Last Updated:** January 2026  
**Version:** 1.0.0
