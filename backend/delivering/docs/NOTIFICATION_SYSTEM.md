# Hybrid Notification System - Implementation Guide

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Installation Steps](#installation-steps)
5. [Module Structure](#module-structure)
6. [Implementation Details](#implementation-details)
7. [Configuration](#configuration)
8. [API Reference](#api-reference)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## 🎯 System Overview

A multi-channel notification system that combines:
- **WebSocket (Socket.IO)** - Real-time notifications for online users
- **Firebase Cloud Messaging (FCM)** - Push notifications for offline/background users
- **Redis** - Caching, pub/sub, and message queue

### Key Features
- ✅ Instant delivery to online users (< 100ms via WebSocket)
- ✅ Guaranteed delivery to offline users (1-3s via FCM)
- ✅ Horizontal scalability with Redis pub/sub
- ✅ Smart routing based on user online status
- ✅ Automatic retry mechanism for failed notifications
- ✅ Notification history and audit trail
- ✅ Real-time location tracking support
- ✅ Multi-server support without sticky sessions

---

## 🏗️ Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Driver App   │  │ Customer App │  │  Admin Panel │      │
│  │ (Mobile)     │  │  (Mobile)    │  │   (Web)      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│    WebSocket          WebSocket          WebSocket           │
│         │                  │                  │               │
└─────────┼──────────────────┼──────────────────┼───────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                     │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              NestJS Backend (Multiple Instances)             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebSocket Gateway (Socket.IO)                       │   │
│  │  - Connection management                             │   │
│  │  - Authentication                                     │   │
│  │  - Room management                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Notifications Service (Orchestrator)                │   │
│  │  - Multi-channel routing                             │   │
│  │  - Smart delivery logic                              │   │
│  │  - Fallback handling                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Firebase Service                                     │   │
│  │  - FCM token management                              │   │
│  │  - Push notification sending                         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Redis Service                                        │   │
│  │  - Connection state caching                          │   │
│  │  - Pub/Sub messaging                                 │   │
│  │  - Queue management                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Redis Cluster   │  │  PostgreSQL  │  │   Firebase   │
│  - Pub/Sub       │  │  - Audit log │  │     FCM      │
│  - Cache         │  │  - History   │  │              │
│  - Queue         │  │  - Users     │  │              │
└──────────────────┘  └──────────────┘  └──────────────┘
```

### Data Flow

#### Scenario 1: New Order → Notify Drivers
```
1. Order Created Event
   ↓
2. Drivers Service finds nearby drivers
   ↓
3. For each driver:
   ├─→ Check Redis: ws:driver:{driverId} exists?
   │   ├─→ YES: Driver is online
   │   │   ├─→ Send via WebSocket (instant)
   │   │   └─→ Send via FCM (backup)
   │   └─→ NO: Driver is offline
   │       └─→ Send via FCM only
   ├─→ Publish to Redis Pub/Sub channel
   │   (for other server instances)
   └─→ Store notification in PostgreSQL
```

#### Scenario 2: Order Status Update → Notify Customer
```
1. Driver accepts/updates order
   ↓
2. Order Service emits event
   ↓
3. Notifications Service:
   ├─→ Check customer online status (Redis)
   ├─→ Send via WebSocket if online
   ├─→ Send via FCM
   └─→ Store in database
```

#### Scenario 3: WebSocket Connection Established
```
1. Client connects with JWT token
   ↓
2. Authenticate user
   ↓
3. Store connection in Redis:
   - Key: ws:user:{userId}
   - Value: {socketId, serverId, timestamp}
   - TTL: 3600 seconds
   ↓
4. Subscribe to Redis channels:
   - notifications:user:{userId}
   - notifications:{userType} (driver/customer)
   ↓
5. Send queued notifications from Redis
```

---

## 🛠️ Technology Stack

### Core Dependencies
```json
{
  "@nestjs/websockets": "^11.0.0",
  "@nestjs/platform-socket.io": "^11.0.0",
  "socket.io": "^4.7.0",
  "firebase-admin": "^12.0.0",
  "ioredis": "^5.3.0",
  "@nestjs/bull": "^10.1.0",
  "bull": "^4.12.0"
}
```

### Why These Technologies?

**Socket.IO**
- Automatic reconnection
- Room/namespace support
- Fallback to long-polling
- Binary data support
- Wide client support (iOS, Android, Web)

**Firebase Cloud Messaging**
- Free unlimited messages
- 99.9% delivery rate
- iOS and Android support
- Rich notifications (images, actions)
- Topic-based messaging

**Redis**
- In-memory speed (< 1ms operations)
- Pub/Sub for real-time messaging
- Built-in data structures (Hash, List, Set)
- Persistence options
- Cluster support for scaling

**Bull Queue**
- Built on Redis
- Delayed jobs
- Priority queues
- Retry logic with exponential backoff
- Job progress tracking

---

## 📦 Installation Steps

### Step 1: Install Dependencies
```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install firebase-admin
npm install ioredis
npm install @nestjs/bull bull
npm install @types/socket.io --save-dev
```

### Step 2: Set Up Redis
```bash
# Option A: Local Development (Docker)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Option B: Production (Managed Service)
# Use AWS ElastiCache, Redis Cloud, or DigitalOcean Managed Redis
```

### Step 3: Set Up Firebase
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Save the JSON file as `firebase-admin-sdk.json`
6. Place in `src/config/firebase-admin-sdk.json`

### Step 4: Update Environment Variables
```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_PATH=./src/config/firebase-admin-sdk.json

WEBSOCKET_PORT=3001
WEBSOCKET_CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

---

## 📁 Module Structure

```
src/
├── notifications/
│   ├── notifications.module.ts
│   ├── notifications.service.ts
│   ├── notifications.gateway.ts         # WebSocket Gateway
│   ├── firebase.service.ts              # FCM Service
│   ├── dto/
│   │   ├── send-notification.dto.ts
│   │   └── notification-payload.dto.ts
│   ├── interfaces/
│   │   ├── notification.interface.ts
│   │   └── websocket-client.interface.ts
│   └── processors/
│       └── notification.processor.ts     # Bull Queue Processor
├── redis/
│   ├── redis.module.ts
│   ├── redis.service.ts
│   └── redis.config.ts
├── config/
│   ├── firebase-admin-sdk.json          # Firebase credentials
│   └── configuration.ts
└── prisma/
    └── schema.prisma                     # Add Notification model
```

---

## 🔧 Implementation Details

### 1. Redis Module

**redis.service.ts**
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const config = {
      host: this.configService.get('REDIS_HOST'),
      port: this.configService.get('REDIS_PORT'),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(config);
    this.subscriber = new Redis(config);
    this.publisher = new Redis(config);
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
  }

  // Connection State Management
  async setUserOnline(userId: number, socketId: string, userType: string) {
    const key = `ws:user:${userId}`;
    const data = {
      socketId,
      serverId: process.env.SERVER_ID || 'server-1',
      userType,
      connectedAt: Date.now(),
    };
    await this.client.setex(key, 3600, JSON.stringify(data));
  }

  async getUserConnection(userId: number) {
    const key = `ws:user:${userId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setUserOffline(userId: number) {
    const key = `ws:user:${userId}`;
    await this.client.del(key);
  }

  async isUserOnline(userId: number): Promise<boolean> {
    const key = `ws:user:${userId}`;
    return (await this.client.exists(key)) === 1;
  }

  // FCM Token Management
  async saveFcmToken(userId: number, token: string, platform: string) {
    const key = `fcm:user:${userId}`;
    const data = { token, platform, updatedAt: Date.now() };
    await this.client.setex(key, 30 * 24 * 3600, JSON.stringify(data));
  }

  async getFcmToken(userId: number) {
    const key = `fcm:user:${userId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteFcmToken(userId: number) {
    const key = `fcm:user:${userId}`;
    await this.client.del(key);
  }

  // Pub/Sub
  async publish(channel: string, message: any) {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void) {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(JSON.parse(msg));
      }
    });
  }

  // Queue Management
  async queueNotification(notification: any) {
    await this.client.lpush(
      'queue:notifications:pending',
      JSON.stringify(notification),
    );
  }

  async dequeueNotification() {
    const data = await this.client.rpop('queue:notifications:pending');
    return data ? JSON.parse(data) : null;
  }

  // Cache
  async set(key: string, value: any, ttl?: number) {
    const data = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, data);
    } else {
      await this.client.set(key, data);
    }
  }

  async get(key: string) {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  getClient(): Redis {
    return this.client;
  }
}
```

**redis.module.ts**
```typescript
import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

---

### 2. WebSocket Gateway

**notifications.gateway.ts**
```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({
  cors: {
    origin: process.env.WEBSOCKET_CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.subscribeToRedisChannels();
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization;
      
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token.replace('Bearer ', ''));
      const userId = payload.sub;
      const userType = payload.role; // 'driver' or 'customer'

      client.data.userId = userId;
      client.data.userType = userType;

      // Store connection in Redis
      await this.redisService.setUserOnline(userId, client.id, userType);

      // Join user-specific room
      client.join(`user:${userId}`);
      client.join(`${userType}s`); // 'drivers' or 'customers'

      this.logger.log(`Client connected: ${client.id} (User: ${userId}, Type: ${userType})`);

      // Send queued notifications
      await this.sendQueuedNotifications(client, userId);

      // Emit connection success
      client.emit('connection:established', {
        userId,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      await this.redisService.setUserOffline(userId);
      this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    }
  }

  @SubscribeMessage('notification:read')
  async handleNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: number },
  ) {
    const userId = client.data.userId;
    await this.notificationsService.markAsRead(data.notificationId, userId);
    return { success: true };
  }

  @SubscribeMessage('fcm:register')
  async handleFcmTokenRegistration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string; platform: string },
  ) {
    const userId = client.data.userId;
    await this.redisService.saveFcmToken(userId, data.token, data.platform);
    this.logger.log(`FCM token registered for user ${userId}`);
    return { success: true };
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { latitude: number; longitude: number },
  ) {
    const userId = client.data.userId;
    const userType = client.data.userType;

    if (userType === 'driver') {
      // Broadcast to customers tracking this driver
      this.server.to(`tracking:driver:${userId}`).emit('driver:location', {
        driverId: userId,
        location: data,
        timestamp: Date.now(),
      });
    }

    return { success: true };
  }

  // Send notification to specific user
  async sendToUser(userId: number, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Send notification to all drivers
  async sendToAllDrivers(event: string, data: any) {
    this.server.to('drivers').emit(event, data);
  }

  // Send notification to all customers
  async sendToAllCustomers(event: string, data: any) {
    this.server.to('customers').emit(event, data);
  }

  // Broadcast to all connected clients
  async broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }

  private async sendQueuedNotifications(client: Socket, userId: number) {
    // Fetch and send any queued notifications for this user
    const queuedNotifications = await this.notificationsService.getQueuedNotifications(userId);
    
    for (const notification of queuedNotifications) {
      client.emit('notification:new', notification);
    }
  }

  private subscribeToRedisChannels() {
    // Subscribe to broadcast channel
    this.redisService.subscribe('notifications:broadcast', (message) => {
      this.broadcast('notification:new', message);
    });

    // Subscribe to driver channel
    this.redisService.subscribe('notifications:drivers', (message) => {
      this.sendToAllDrivers('notification:new', message);
    });

    // Subscribe to customer channel
    this.redisService.subscribe('notifications:customers', (message) => {
      this.sendToAllCustomers('notification:new', message);
    });
  }
}
```

---

### 3. Firebase Service

**firebase.service.ts**
```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private messaging: admin.messaging.Messaging;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  onModuleInit() {
    const serviceAccountPath = this.configService.get('FIREBASE_PRIVATE_KEY_PATH');
    
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: this.configService.get('FIREBASE_PROJECT_ID'),
    });

    this.messaging = admin.messaging();
    this.logger.log('Firebase Admin SDK initialized');
  }

  async sendToUser(
    userId: number,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<boolean> {
    try {
      const tokenData = await this.redisService.getFcmToken(userId);
      
      if (!tokenData || !tokenData.token) {
        this.logger.warn(`No FCM token found for user ${userId}`);
        return false;
      }

      const message: admin.messaging.Message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        token: tokenData.token,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'orders',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await this.messaging.send(message);
      this.logger.log(`FCM sent to user ${userId}: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`FCM error for user ${userId}: ${error.message}`);
      
      // Handle invalid token
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        await this.redisService.deleteFcmToken(userId);
      }
      
      return false;
    }
  }

  async sendToMultipleUsers(
    userIds: number[],
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<{ success: number; failed: number }> {
    const tokens: string[] = [];
    const tokenUserMap: Map<string, number> = new Map();

    // Collect all tokens
    for (const userId of userIds) {
      const tokenData = await this.redisService.getFcmToken(userId);
      if (tokenData && tokenData.token) {
        tokens.push(tokenData.token);
        tokenUserMap.set(tokenData.token, userId);
      }
    }

    if (tokens.length === 0) {
      return { success: 0, failed: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        tokens,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'orders',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.sendEachForMulticast(message);
      
      // Handle failed tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const token = tokens[idx];
          const userId = tokenUserMap.get(token);
          this.logger.error(`FCM failed for user ${userId}: ${resp.error?.message}`);
          
          if (resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered') {
            this.redisService.deleteFcmToken(userId);
          }
        }
      });

      this.logger.log(`FCM batch sent: ${response.successCount} success, ${response.failureCount} failed`);
      
      return {
        success: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`FCM batch error: ${error.message}`);
      return { success: 0, failed: tokens.length };
    }
  }

  async sendToTopic(
    topic: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<boolean> {
    try {
      const message: admin.messaging.Message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        topic,
      };

      const response = await this.messaging.send(message);
      this.logger.log(`FCM sent to topic ${topic}: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`FCM topic error: ${error.message}`);
      return false;
    }
  }

  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    try {
      await this.messaging.subscribeToTopic([token], topic);
      return true;
    } catch (error) {
      this.logger.error(`Subscribe to topic error: ${error.message}`);
      return false;
    }
  }
}
```

---

### 4. Enhanced Notifications Service

**notifications.service.ts**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FirebaseService } from './firebase.service';
import { NotificationsGateway } from './notifications.gateway';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export enum NotificationType {
  ORDER_CREATED = 'order_created',
  ORDER_ACCEPTED = 'order_accepted',
  ORDER_PICKED_UP = 'order_picked_up',
  ORDER_DELIVERED = 'order_delivered',
  ORDER_CANCELLED = 'order_cancelled',
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_NEARBY = 'driver_nearby',
  PAYMENT_RECEIVED = 'payment_received',
}

export interface NotificationPayload {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly firebaseService: FirebaseService,
    private readonly notificationsGateway: NotificationsGateway,
    @InjectQueue('notifications') private notificationQueue: Queue,
  ) {}

  /**
   * Main method to send notification through all channels
   */
  async sendNotification(payload: NotificationPayload): Promise<void> {
    const { userId, type, title, message, data, priority = 'normal' } = payload;

    this.logger.log(`Sending notification to user ${userId}: ${title}`);

    // 1. Store in database for history
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        isRead: false,
      },
    });

    // 2. Check if user is online
    const isOnline = await this.redisService.isUserOnline(userId);

    // 3. Send via WebSocket if online
    if (isOnline) {
      try {
        await this.notificationsGateway.sendToUser(userId, 'notification:new', {
          id: notification.id,
          type,
          title,
          message,
          data,
          timestamp: notification.createdAt,
        });
        this.logger.log(`WebSocket sent to user ${userId}`);
      } catch (error) {
        this.logger.error(`WebSocket error for user ${userId}: ${error.message}`);
      }
    }

    // 4. Send via FCM (always, as backup or primary)
    const fcmSent = await this.firebaseService.sendToUser(userId, {
      title,
      body: message,
      data: {
        notificationId: notification.id.toString(),
        type,
        ...data,
      },
    });

    // 5. If both failed and high priority, queue for retry
    if (!isOnline && !fcmSent && priority === 'high') {
      await this.notificationQueue.add(
        'retry-notification',
        { notificationId: notification.id, payload },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
    }

    // 6. Publish to Redis pub/sub for other server instances
    await this.redisService.publish(`notifications:user:${userId}`, {
      id: notification.id,
      type,
      title,
      message,
      data,
    });
  }

  /**
   * Send notification to multiple users (batch)
   */
  async sendBatchNotification(
    userIds: number[],
    notification: {
      type: NotificationType;
      title: string;
      message: string;
      data?: Record<string, any>;
    },
  ): Promise<void> {
    this.logger.log(`Sending batch notification to ${userIds.length} users`);

    // Send to each user
    const promises = userIds.map((userId) =>
      this.sendNotification({
        userId,
        ...notification,
      }),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Notify nearby drivers of new order
   */
  async notifyDriverOfNewOrder(
    driverId: number,
    driverUserId: number,
    orderId: number,
    distanceMeters: number,
  ): Promise<void> {
    const distanceKm = (distanceMeters / 1000).toFixed(1);
    
    await this.sendNotification({
      userId: driverUserId,
      type: NotificationType.ORDER_CREATED,
      title: 'New Order Available',
      message: `Order #${orderId} is ${distanceKm}km away. Accept now!`,
      data: {
        orderId: orderId.toString(),
        driverId: driverId.toString(),
        distance: distanceMeters.toString(),
      },
      priority: 'high',
    });
  }

  /**
   * Notify customer of order status change
   */
  async notifyCustomerOrderStatus(
    customerId: number,
    orderId: number,
    status: string,
  ): Promise<void> {
    const messages = {
      accepted: 'Your order has been accepted by a driver',
      picked_up: 'Driver has picked up your order',
      on_the_way: 'Driver is on the way to your location',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled',
    };

    await this.sendNotification({
      userId: customerId,
      type: NotificationType[`ORDER_${status.toUpperCase()}`] || NotificationType.ORDER_ACCEPTED,
      title: 'Order Update',
      message: messages[status] || `Order status: ${status}`,
      data: {
        orderId: orderId.toString(),
        status,
      },
      priority: 'high',
    });
  }

  /**
   * Broadcast to all drivers
   */
  async broadcastToDrivers(
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<void> {
    await this.notificationsGateway.sendToAllDrivers('notification:broadcast', {
      title,
      message,
      data,
      timestamp: Date.now(),
    });

    await this.firebaseService.sendToTopic('all-drivers', {
      title,
      body: message,
      data,
    });
  }

  /**
   * Get queued notifications for user
   */
  async getQueuedNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get notification history for user
   */
  async getUserNotifications(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
```

---

### 5. Bull Queue Processor

**notification.processor.ts**
```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NotificationsService, NotificationPayload } from './notifications.service';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Process('retry-notification')
  async handleRetryNotification(job: Job<{ notificationId: number; payload: NotificationPayload }>) {
    const { notificationId, payload } = job.data;
    
    this.logger.log(`Retrying notification ${notificationId} (Attempt ${job.attemptsMade + 1})`);

    try {
      await this.notificationsService.sendNotification(payload);
      return { success: true };
    } catch (error) {
      this.logger.error(`Retry failed for notification ${notificationId}: ${error.message}`);
      throw error; // Will trigger retry
    }
  }

  @Process('scheduled-notification')
  async handleScheduledNotification(job: Job<NotificationPayload>) {
    this.logger.log(`Processing scheduled notification for user ${job.data.userId}`);
    await this.notificationsService.sendNotification(job.data);
  }
}
```

---

### 6. Prisma Schema Update

**schema.prisma**
```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  type      String
  title     String
  message   String
  data      String?  @db.Text
  isRead    Boolean  @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

// Add to User model
model User {
  // ... existing fields
  notifications Notification[]
}
```

---

### 7. Notifications Module

**notifications.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { FirebaseService } from './firebase.service';
import { NotificationProcessor } from './processors/notification.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsGateway,
    FirebaseService,
    NotificationProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

---

### 8. App Module Update

**app.module.ts**
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from './redis/redis.module';
import { NotificationsModule } from './notifications/notifications.module';
// ... other imports

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    RedisModule,
    NotificationsModule,
    // ... other modules
  ],
})
export class AppModule {}
```

---

## 🔐 Security Best Practices

### 1. WebSocket Authentication
- Always validate JWT tokens on connection
- Implement rate limiting per connection
- Use secure WebSocket (WSS) in production

### 2. FCM Token Management
- Encrypt tokens in Redis
- Validate token ownership before sending
- Implement token rotation
- Revoke tokens on user logout

### 3. Redis Security
- Enable Redis AUTH with strong password
- Use TLS/SSL for Redis connections in production
- Implement key expiration policies
- Restrict Redis commands (disable dangerous commands)

### 4. Data Privacy
- Don't send sensitive data in notifications
- Use notification IDs and fetch details via API
- Implement user consent for push notifications
- Allow users to manage notification preferences

---

## 📊 Monitoring & Analytics

### Key Metrics to Track

1. **Delivery Metrics**
   - WebSocket delivery rate
   - FCM delivery rate
   - Average delivery time
   - Failed delivery count

2. **Connection Metrics**
   - Active WebSocket connections
   - Connection duration
   - Reconnection rate
   - Concurrent users

3. **Performance Metrics**
   - Redis operation latency
   - Queue processing time
   - Notification throughput
   - Error rates

### Logging Strategy
```typescript
// Add to notifications.service.ts
private async logNotificationMetrics(
  userId: number,
  type: string,
  channels: string[],
  success: boolean,
  duration: number,
) {
  await this.prisma.notificationLog.create({
    data: {
      userId,
      type,
      channels: channels.join(','),
      success,
      duration,
      timestamp: new Date(),
    },
  });
}
```

---

## 🧪 Testing

### Unit Tests Example
```typescript
// notifications.service.spec.ts
describe('NotificationsService', () => {
  let service: NotificationsService;
  let redisService: RedisService;
  let firebaseService: FirebaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: RedisService,
          useValue: {
            isUserOnline: jest.fn(),
            publish: jest.fn(),
          },
        },
        {
          provide: FirebaseService,
          useValue: {
            sendToUser: jest.fn(),
          },
        },
        // ... other mocks
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    redisService = module.get<RedisService>(RedisService);
    firebaseService = module.get<FirebaseService>(FirebaseService);
  });

  it('should send notification via WebSocket when user is online', async () => {
    jest.spyOn(redisService, 'isUserOnline').mockResolvedValue(true);
    
    await service.sendNotification({
      userId: 1,
      type: NotificationType.ORDER_CREATED,
      title: 'Test',
      message: 'Test message',
    });

    // Assert WebSocket was called
  });
});
```

### Integration Tests
```typescript
// Test WebSocket connection
describe('NotificationsGateway (e2e)', () => {
  let app: INestApplication;
  let socket: Socket;

  beforeAll(async () => {
    // Setup test app
  });

  it('should connect with valid JWT', (done) => {
    socket = io('http://localhost:3001/notifications', {
      auth: { token: 'valid-jwt-token' },
    });

    socket.on('connection:established', (data) => {
      expect(data.userId).toBeDefined();
      done();
    });
  });
});
```

---

## 🚀 Deployment

### Environment Variables
```bash
# Production .env
NODE_ENV=production

# Redis
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-password
REDIS_TLS=true

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_PATH=./config/firebase-admin-sdk.json

# WebSocket
WEBSOCKET_CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# JWT
JWT_SECRET=your-jwt-secret

# Database
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
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

### Nginx Configuration
```nginx
# WebSocket proxy
upstream websocket {
    ip_hash;
    server app1:3001;
    server app2:3001;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    # WebSocket location
    location /notifications {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # REST API
    location / {
        proxy_pass http://app:3000;
    }
}
```

---

## 📱 Client Implementation Examples

### React Native (Mobile)
```typescript
// NotificationService.ts
import io from 'socket.io-client';
import messaging from '@react-native-firebase/messaging';

class NotificationService {
  private socket: Socket;

  async initialize(token: string) {
    // Connect WebSocket
    this.socket = io('https://api.yourdomain.com/notifications', {
      auth: { token },
    });

    this.socket.on('notification:new', (data) => {
      // Show in-app notification
      this.showInAppNotification(data);
    });

    // Register FCM token
    const fcmToken = await messaging().getToken();
    this.socket.emit('fcm:register', {
      token: fcmToken,
      platform: Platform.OS,
    });

    // Handle FCM foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('FCM foreground:', remoteMessage);
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }
}
```

### React (Web)
```typescript
// useNotifications.ts
import { useEffect } from 'react';
import io from 'socket.io-client';

export const useNotifications = (token: string) => {
  useEffect(() => {
    const socket = io('https://api.yourdomain.com/notifications', {
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

## 🔄 Migration Guide

### Step 1: Run Prisma Migration
```bash
npx prisma migrate dev --name add_notifications
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env
# Edit .env with your values
```

### Step 4: Start Redis
```bash
docker-compose up -d redis
```

### Step 5: Start Application
```bash
npm run start:dev
```

---

## 📞 Support & Troubleshooting

### Common Issues

**WebSocket connection fails**
- Check CORS configuration
- Verify JWT token is valid
- Check firewall/load balancer settings

**FCM notifications not received**
- Verify Firebase credentials
- Check FCM token is registered
- Ensure app has notification permissions

**Redis connection errors**
- Verify Redis is running
- Check connection credentials
- Ensure network connectivity

**High latency**
- Check Redis performance
- Monitor WebSocket connection count
- Review database query performance

---

## 📈 Performance Optimization

### Redis Optimization
- Use Redis pipelining for bulk operations
- Implement connection pooling
- Set appropriate TTL for cached data
- Use Redis Cluster for high availability

### WebSocket Optimization
- Implement heartbeat/ping-pong
- Use binary data when possible
- Compress large payloads
- Limit room sizes

### FCM Optimization
- Batch notifications (up to 500 per request)
- Use topic messaging for broadcasts
- Implement exponential backoff for retries
- Cache tokens in Redis

---

## 🎯 Next Steps

1. **Implement the code** following this guide
2. **Test thoroughly** with unit and integration tests
3. **Monitor metrics** in production
4. **Optimize** based on real-world usage
5. **Scale** horizontally as needed

---

## 📚 Additional Resources

- [Socket.IO Documentation](https://socket.io/docs/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Redis Documentation](https://redis.io/documentation)
- [Bull Queue](https://github.com/OptimalBits/bull)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)

---

**Last Updated:** January 2026  
**Version:** 1.0.0  
**Author:** Cascade AI
