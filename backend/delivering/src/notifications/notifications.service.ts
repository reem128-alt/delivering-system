import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FirebaseService } from './firebase.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  NotificationType,
  NotificationPayload,
} from './dto/send-notification.dto';
import type { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private gateway: NotificationsGateway;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly firebaseService: FirebaseService,
    @InjectQueue('notifications') private notificationQueue: Queue,
  ) {}

  setGateway(gateway: NotificationsGateway) {
    this.gateway = gateway;
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    const { userId, type, title, message, data, priority = 'normal' } = payload;

    this.logger.log(`Sending notification to user ${userId}: ${title}`);

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

    this.logger.log(
      `✅ Notification created: ID=${notification.id}, userId=${userId}, type=${type}`,
    );

    const isOnline = await this.redisService.isUserOnline(userId);

    if (isOnline && this.gateway) {
      try {
        this.gateway.sendToUser(userId, 'notification:new', {
          id: notification.id,
          type,
          title,
          message,
          data,
          timestamp: notification.createdAt,
        });
        this.logger.log(`WebSocket sent to user ${userId}`);
      } catch (error) {
        const errorMessage = error as Error;
        this.logger.error(
          `WebSocket error for user ${userId}: ${errorMessage.message}`,
        );
      }
    }

    const fcmSent = await this.firebaseService.sendToUser(userId, {
      title,
      body: message,
      data: {
        notificationId: notification.id.toString(),
        type,
        ...data,
      },
    });

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

    await this.redisService.publish(`notifications:user:${userId}`, {
      id: notification.id,
      type,
      title,
      message,
      data,
    });
  }

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

    const promises = userIds.map((userId) =>
      this.sendNotification({
        userId,
        ...notification,
      }),
    );

    await Promise.allSettled(promises);
  }

  async notifyDriverOfNewOrder(
    driverId: number,
    driverUserId: number,
    orderId: number,
    distanceMeters: number,
  ): Promise<void> {
    const distanceKm = (distanceMeters / 1000).toFixed(1);

    this.logger.log(
      `📢 Notifying driver: driverId=${driverId}, driverUserId=${driverUserId}, orderId=${orderId}`,
    );

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

  async notifyCustomerOrderStatus(
    customerId: number,
    orderId: number,
    status: string,
  ): Promise<void> {
    const messages: Record<string, string> = {
      accepted: 'Your order has been accepted by a driver',
      picked_up: 'Driver has picked up your order',
      on_the_way: 'Driver is on the way to your location',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled',
    };

    await this.sendNotification({
      userId: customerId,
      type: NotificationType.ORDER_ACCEPTED,
      title: 'Order Update',
      message: messages[status] || `Order status: ${status}`,
      data: {
        orderId: orderId.toString(),
        status,
      },
      priority: 'high',
    });
  }

  async broadcastToDrivers(
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (this.gateway) {
      this.gateway.sendToAllDrivers('notification:broadcast', {
        title,
        message,
        data,
        timestamp: Date.now(),
      });
    }

    await this.firebaseService.sendToTopic('all-drivers', {
      title,
      body: message,
      data: data as Record<string, string> | undefined,
    });
  }

  async getQueuedNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
  }

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

  async getUserNotifications(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    this.logger.log(`🔍 Querying notifications for userId=${userId}`);

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    this.logger.log(
      `📋 Found ${notifications.length} notifications for userId=${userId} (total: ${total})`,
    );

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
