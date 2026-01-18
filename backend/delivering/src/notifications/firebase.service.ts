import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

interface FcmTokenData {
  token: string;
  platform: string;
  updatedAt: number;
}

interface FirebaseError extends Error {
  code?: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private messaging: admin.messaging.Messaging;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  onModuleInit() {
    try {
      // Check if Firebase is disabled
      if (
        process.env.NODE_ENV === 'development' &&
        process.env.DISABLE_FCM === 'true'
      ) {
        this.logger.warn('FCM notifications disabled in development');
        return;
      }

      const serviceAccountPath = this.configService.get<string>(
        'FIREBASE_PRIVATE_KEY_PATH',
      );

      if (!serviceAccountPath) {
        this.logger.warn(
          'Firebase credentials not configured. FCM notifications will be disabled.',
        );
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(
        serviceAccountPath,
      ) as admin.ServiceAccount;

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      });

      this.messaging = admin.messaging();
      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      const firebaseError = error as FirebaseError;
      this.logger.error(
        `Firebase initialization failed: ${firebaseError.message}`,
      );
      this.logger.warn(
        "FCM notifications will be disabled. This is normal if you don't have Firebase configured.",
      );
    }
  }

  async sendToUser(
    userId: number,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ): Promise<boolean> {
    if (!this.messaging) {
      this.logger.warn('Firebase not initialized. Skipping FCM notification.');
      return false;
    }

    try {
      const tokenData = (await this.redisService.getFcmToken(
        userId,
      )) as FcmTokenData | null;

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
      const firebaseError = error as FirebaseError;
      this.logger.error(
        `FCM error for user ${userId}: ${firebaseError.message}`,
      );

      if (
        firebaseError.code === 'messaging/invalid-registration-token' ||
        firebaseError.code === 'messaging/registration-token-not-registered'
      ) {
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
    if (!this.messaging) {
      this.logger.warn('Firebase not initialized. Skipping FCM notifications.');
      return { success: 0, failed: 0 };
    }

    const tokens: string[] = [];
    const tokenUserMap: Map<string, number> = new Map();

    for (const userId of userIds) {
      const tokenData = (await this.redisService.getFcmToken(
        userId,
      )) as FcmTokenData | null;
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

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const token = tokens[idx];
          const userId = tokenUserMap.get(token);
          this.logger.error(
            `FCM failed for user ${userId}: ${resp.error?.message}`,
          );

          if (
            resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered'
          ) {
            if (userId) {
              void this.redisService.deleteFcmToken(userId);
            }
          }
        }
      });

      this.logger.log(
        `FCM batch sent: ${response.successCount} success, ${response.failureCount} failed`,
      );

      return {
        success: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      const firebaseError = error as FirebaseError;
      this.logger.error(`FCM batch error: ${firebaseError.message}`);
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
    if (!this.messaging) {
      this.logger.warn('Firebase not initialized. Skipping FCM notification.');
      return false;
    }

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
      const firebaseError = error as FirebaseError;
      this.logger.error(`FCM topic error: ${firebaseError.message}`);
      return false;
    }
  }

  async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    if (!this.messaging) {
      return false;
    }

    try {
      await this.messaging.subscribeToTopic([token], topic);
      return true;
    } catch (error) {
      const firebaseError = error as FirebaseError;
      this.logger.error(`Subscribe to topic error: ${firebaseError.message}`);
      return false;
    }
  }
}
