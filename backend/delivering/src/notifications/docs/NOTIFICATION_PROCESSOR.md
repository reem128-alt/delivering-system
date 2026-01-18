# Notification Processor Documentation

## 📚 Overview: NestJS Bull Processor & Queue System

### 🔧 What is Bull?

**Bull** is a Redis-based queue system for Node.js that handles:
- **Background jobs** (processing tasks asynchronously)
- **Job scheduling** (delayed execution)
- **Retry mechanisms** (automatic retries on failure)
- **Job prioritization** (high/normal/low priority)
- **Concurrency control** (limiting simultaneous jobs)

### 🏗️ What is NestJS/Bull Integration?

NestJS provides decorators to integrate Bull seamlessly:
- `@Processor()` - Marks a class as a job processor
- `@Process()` - Marks a method to handle specific job types
- `@InjectQueue()` - Injects a queue instance for adding jobs

---

## 📋 File Analysis: `notification.processor.ts`

### **Purpose:**
This processor handles **background notification tasks** that shouldn't block the main application flow.

### **Key Components:**

#### **1. Processor Class (Line 7-8)**
```typescript
@Processor('notifications')
export class NotificationProcessor
```
- Registers this class to handle jobs from the `'notifications'` queue
- All notification-related background jobs go through this processor

#### **2. Retry Handler (Lines 13-33)**
```typescript
@Process('retry-notification')
async handleRetryNotification(job: Job<{ notificationId: number; payload: NotificationPayload }>)
```

**What it does:**
- **Handles failed notifications** that need to be retried
- **Tracks attempt count** (`job.attemptsMade + 1`)
- **Re-sends the notification** using the original payload
- **Logs success/failure** for monitoring

**When triggered:**
- When a notification fails to send (user offline, FCM token invalid, etc.)
- The system automatically adds retry jobs with exponential backoff

#### **3. Scheduled Handler (Lines 35-41)**
```typescript
@Process('scheduled-notification')
async handleScheduledNotification(job: Job<NotificationPayload>)
```

**What it does:**
- **Processes time-delayed notifications**
- **Sends notifications at specific times** (reminders, promotions, etc.)

**Use cases:**
- Order delivery reminders
- Promotional notifications
- Scheduled updates

---

## 🔄 How It Works in Your System

### **Flow Example:**

1. **Notification Send Attempt:**
   ```typescript
   // In notifications.service.ts
   if (!isOnline && !fcmSent && priority === 'high') {
     await this.notificationQueue.add(
       'retry-notification',  // ← Job type
       { notificationId, payload },
       { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
     );
   }
   ```

2. **Background Processing:**
   - Bull picks up the job from Redis queue
   - Calls `handleRetryNotification()` method
   - Attempts to resend the notification
   - If fails, retries automatically (up to 3 attempts)

3. **Job Lifecycle:**
   ```
   Created → Queued → Processing → Completed/Failed
   ```

---

## 💡 Benefits of This Architecture

### **Advantages:**
1. **Non-blocking:** Main app remains responsive
2. **Reliability:** Automatic retries ensure delivery
3. **Scalability:** Handle thousands of notifications
4. **Monitoring:** Built-in job tracking and logging
5. **Flexibility:** Schedule future notifications

### **Real-world Scenarios:**

| Scenario | How Processor Helps |
|----------|-------------------|
| **User Offline** | Retries when user comes back online |
| **FCM Token Expired** | Retries with updated token |
| **Network Issues** | Automatic retry with exponential backoff |
| **Scheduled Promotions** | Sends at optimal times |
| **High Volume** | Processes in background without blocking |

---

## 🎯 Key Takeaways

- **Processor = Background Worker** for notification tasks
- **Bull = Queue Manager** using Redis for job storage
- **Retry Logic** ensures reliable delivery
- **Scheduled Jobs** enable time-based notifications
- **Non-blocking** architecture maintains app performance

This system ensures your notifications are **reliable, scalable, and efficient** while keeping your main application fast and responsive! 🚀
