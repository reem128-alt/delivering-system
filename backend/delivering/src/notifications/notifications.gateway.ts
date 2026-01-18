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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';

interface JwtPayload {
  sub: number;
  role: string;
}

interface ClientData {
  userId: number;
  userType: string;
}

interface NotificationData {
  notificationId: number;
}

interface FcmTokenData {
  token: string;
  platform: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
}

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
  ) {
    this.subscribeToRedisChannels();
  }

  handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth.token ||
        client.handshake.headers.authorization) as string;

      if (!token) {
        this.logger.warn('Client connection rejected: No token provided');
        client.disconnect();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = this.jwtService.verify(token.replace('Bearer ', ''));
      const userId = (payload as JwtPayload).sub;
      const userType = (payload as JwtPayload).role;

      const clientData = client.data as ClientData;
      clientData.userId = userId;
      clientData.userType = userType;

      void this.redisService.setUserOnline(userId, client.id, userType);

      void client.join(`user:${userId}`);
      void client.join(`${userType}s`);

      this.logger.log(
        `Client connected: ${client.id} (User: ${userId}, Type: ${userType})`,
      );

      client.emit('connection:established', {
        userId,
        timestamp: Date.now(),
      });
    } catch (error) {
      const errorMessage = error as Error;
      this.logger.error(`Connection error: ${errorMessage.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const clientData = client.data as ClientData;
    const userId = clientData.userId;
    if (userId) {
      await this.redisService.setUserOffline(userId);
      this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    }
  }

  @SubscribeMessage('notification:read')
  handleNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: NotificationData,
  ) {
    const clientData = client.data as ClientData;
    const userId = clientData.userId;
    this.logger.log(
      `User ${userId} marked notification ${data.notificationId} as read`,
    );
    return { success: true };
  }

  @SubscribeMessage('fcm:register')
  async handleFcmTokenRegistration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: FcmTokenData,
  ) {
    const clientData = client.data as ClientData;
    const userId = clientData.userId;
    await this.redisService.saveFcmToken(userId, data.token, data.platform);
    this.logger.log(`FCM token registered for user ${userId}`);
    return { success: true };
  }

  @SubscribeMessage('location:update')
  handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationData,
  ) {
    const clientData = client.data as ClientData;
    const userId = clientData.userId;
    const userType = clientData.userType;

    if (userType === 'driver') {
      this.server.to(`tracking:driver:${userId}`).emit('driver:location', {
        driverId: userId,
        location: data,
        timestamp: Date.now(),
      });
    }

    return { success: true };
  }

  sendToUser(userId: number, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  sendToAllDrivers(event: string, data: unknown) {
    this.server.to('drivers').emit(event, data);
  }

  sendToAllCustomers(event: string, data: unknown) {
    this.server.to('customers').emit(event, data);
  }

  broadcast(event: string, data: unknown) {
    this.server.emit(event, data);
  }

  private subscribeToRedisChannels() {
    void this.redisService.subscribe('notifications:broadcast', (message) => {
      void this.broadcast('notification:new', message);
    });

    void this.redisService.subscribe('notifications:drivers', (message) => {
      void this.sendToAllDrivers('notification:new', message);
    });

    void this.redisService.subscribe('notifications:customers', (message) => {
      void this.sendToAllCustomers('notification:new', message);
    });
  }
}
