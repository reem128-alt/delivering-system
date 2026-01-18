import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DriversService } from './drivers.service';
import { DriversResolver } from './drivers.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule, EventEmitterModule],
  providers: [DriversService, DriversResolver],
  exports: [DriversService],
})
export class DriversModule {}
