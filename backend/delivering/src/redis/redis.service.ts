import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const config = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      host: this.configService.get(
        'REDIS_HOST',
        'redis-15824.c325.us-east-1-4.ec2.cloud.redislabs.com',
      ),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      port: this.configService.get('REDIS_PORT', 15824),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      password: this.configService.get('REDIS_PASSWORD'),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      db: this.configService.get('REDIS_DB', 0),
      connectTimeout: 10000, // 10 seconds connection timeout
      commandTimeout: 10000, // 10 seconds command timeout (increased for network latency)
      lazyConnect: true, // Don't connect immediately
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    };

    this.client = new Redis(config);
    this.subscriber = new Redis(config);
    this.publisher = new Redis(config);

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis client error: ${error.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis client reconnecting...');
    });

    // Explicitly connect to Redis
    this.client.connect().catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect to Redis: ${errorMessage}`);
    });

    this.subscriber.connect().catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect Redis subscriber: ${errorMessage}`);
    });

    this.publisher.connect().catch((error: unknown) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect Redis publisher: ${errorMessage}`);
    });

    this.logger.log('Redis service initialized');
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
    this.logger.log('Redis connections closed');
  }

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

  async saveFcmToken(userId: number, token: string, platform: string) {
    const key = `fcm:user:${userId}`;
    const data = { token, platform, updatedAt: Date.now() };
    await this.client.setex(key, 30 * 24 * 3600, JSON.stringify(data));
  }

  async getFcmToken(userId: number) {
    const key = `fcm:user:${userId}`;
    const data = await this.client.get(key);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data ? JSON.parse(data) : null;
  }

  async deleteFcmToken(userId: number) {
    const key = `fcm:user:${userId}`;
    await this.client.del(key);
  }

  async publish(channel: string, message: unknown) {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: unknown) => void) {
    if (!this.subscriber) {
      this.logger.warn('Redis subscriber not initialized');
      return;
    }
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(JSON.parse(msg));
      }
    });
  }

  async queueNotification(notification: unknown) {
    await this.client.lpush(
      'queue:notifications:pending',
      JSON.stringify(notification),
    );
  }

  async dequeueNotification() {
    const data = await this.client.rpop('queue:notifications:pending');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: unknown, ttl?: number) {
    const data = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, data);
    } else {
      await this.client.set(key, data);
    }
  }

  async get(key: string) {
    const data = await this.client.get(key);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data ? JSON.parse(data) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  getClient(): Redis {
    return this.client;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }
}
