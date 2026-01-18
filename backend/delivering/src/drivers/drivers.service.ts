import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderCreatedEvent } from './events/order-created.event';
import { NearestDriverModel } from './entities/nearest-driver.model';
import { DriverModel } from './entities/driver.model';
import { CreateDriverInput } from './dto/create-driver.input';
import { UpdateDriverLocationInput } from './dto/update-driver-location.input';
import { UpdateDriverStatusInput } from './dto/update-driver-status.input';
import { DriverStatus } from './enums/driver-status.enum';
import { OrderStatus } from '../orders/enums/order-status.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);
  // logger instance Creates a logger that will prefix all log messages with "DriversService" */

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(input: CreateDriverInput): Promise<DriverModel> {
    // Check if user with this email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      // Check if this user already has a driver profile
      const existingDriver = await this.prisma.driver.findUnique({
        where: { userId: existingUser.id },
      });

      if (existingDriver) {
        throw new Error(`Driver with email ${input.email} already exists`);
      } else {
        throw new Error(
          `User with email ${input.email} already exists but is not a driver`,
        );
      }
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user first
      const user = await tx.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name,
          role: 'DRIVER',
        },
      });

      // Then create driver linked to the user
      const driver = await tx.$queryRaw<DriverModel[]>`
        INSERT INTO "Driver" ("userId", status, location, phone, "vehicleType", "licensePlate", "createdAt", "updatedAt")
        VALUES (
          ${user.id},
          ${input.status || 'AVAILABLE'},
          ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          ${input.phone},
          ${input.vehicleType},
          ${input.licensePlate},
          NOW(),
          NOW()
        )
        RETURNING id, "userId", status, phone, "vehicleType", "licensePlate", "createdAt", "updatedAt"
      `;

      // Return driver with user information
      return {
        ...driver[0],
        user: {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role,
        },
      };
    });

    return result;
  }

  async findAll(): Promise<DriverModel[]> {
    const drivers = await this.prisma.driver.findMany({
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return drivers.map((d) => ({
      id: d.id,
      userId: d.userId,
      status: d.status as DriverStatus,
      phone: d.phone || undefined,
      vehicleType: d.vehicleType || undefined,
      licensePlate: d.licensePlate || undefined,
      user: {
        id: d.user.id,
        email: d.user.email,
        name: d.user.name || undefined,
        role: d.user.role,
      },
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  async findOne(id: number): Promise<DriverModel | null> {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!driver) return null;
    return {
      id: driver.id,
      userId: driver.userId,
      status: driver.status as DriverStatus,
      phone: driver.phone || undefined,
      vehicleType: driver.vehicleType || undefined,
      licensePlate: driver.licensePlate || undefined,
      user: {
        id: driver.user.id,
        email: driver.user.email,
        name: driver.user.name || undefined,
        role: driver.user.role,
      },
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }

  async findByUserId(userId: number): Promise<DriverModel | null> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!driver) return null;
    return {
      id: driver.id,
      userId: driver.userId,
      status: driver.status as DriverStatus,
      phone: driver.phone || undefined,
      vehicleType: driver.vehicleType || undefined,
      licensePlate: driver.licensePlate || undefined,
      user: {
        id: driver.user.id,
        email: driver.user.email,
        name: driver.user.name || undefined,
        role: driver.user.role,
      },
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }

  async updateLocation(input: UpdateDriverLocationInput): Promise<DriverModel> {
    const driver = await this.prisma.$queryRaw<DriverModel[]>`
      UPDATE "Driver"
      SET location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography,
          "updatedAt" = NOW()
      WHERE id = ${input.driverId}
      RETURNING id, "userId", status, phone, "vehicleType", "licensePlate", "createdAt", "updatedAt"
    `;
    if (!driver[0]) {
      throw new NotFoundException(`Driver #${input.driverId} not found`);
    }
    return driver[0];
  }

  async updateStatus(input: UpdateDriverStatusInput): Promise<DriverModel> {
    const driver = await this.prisma.$queryRaw<DriverModel[]>`
      UPDATE "Driver"
      SET status = ${input.status}::"DriverStatus",
          "updatedAt" = NOW()
      WHERE id = ${input.driverId}
      RETURNING id, "userId", status, phone, "vehicleType", "licensePlate", "createdAt", "updatedAt"
    `;
    if (!driver[0]) {
      throw new NotFoundException(`Driver #${input.driverId} not found`);
    }
    return driver[0];
  }

  async remove(id: number): Promise<DriverModel> {
    const driver = await this.prisma.driver.delete({ where: { id } });
    return {
      id: driver.id,
      userId: driver.userId,
      status: driver.status as DriverStatus,
      phone: driver.phone || undefined,
      vehicleType: driver.vehicleType || undefined,
      licensePlate: driver.licensePlate || undefined,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
  }

  /**
   * Find nearest available drivers to a pickup location using PostGIS
   * @param pickupLat Pickup latitude
   * @param pickupLng Pickup longitude
   * @param limit Max number of drivers to return
   * @param maxDistanceMeters Max search radius in meters (default 10km)
   */
  async findNearestDrivers(
    pickupLat: number,
    pickupLng: number,
    limit = 5,
    maxDistanceMeters = 10000,
  ): Promise<NearestDriverModel[]> {
    const drivers = await this.prisma.$queryRaw<NearestDriverModel[]>`
      SELECT 
        d.id,
        d."userId",
        d.status,
        ST_Distance(d.location, ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography) as "distanceMeters"
      FROM "Driver" d
      WHERE d.status = 'AVAILABLE'
        AND ST_DWithin(
          d.location,
          ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326)::geography,
          ${maxDistanceMeters}
        )
      ORDER BY "distanceMeters" ASC
      LIMIT ${limit}
    `;
    return drivers;
  }

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(
      `Order #${event.orderId} created, finding nearest drivers...`,
    );

    const nearestDrivers = await this.findNearestDrivers(
      event.pickupLat,
      event.pickupLng,
    );

    if (nearestDrivers.length === 0) {
      this.logger.warn(
        `No available drivers found near order #${event.orderId}`,
      );
      return;
    }

    this.logger.log(
      `Found ${nearestDrivers.length} drivers for order #${event.orderId}: ` +
        nearestDrivers
          .map((d) => `Driver #${d.id} (${Math.round(d.distanceMeters)}m)`)
          .join(', '),
    );

    // Update order status to SEARCHING_DRIVER
    await this.prisma.order.update({
      where: { id: event.orderId },
      data: { status: OrderStatus.SEARCHING_DRIVER },
    });

    this.logger.log(
      `Order #${event.orderId} set to SEARCHING_DRIVER, notifying drivers...`,
    );

    // Notify all nearby drivers about the new order
    for (const driver of nearestDrivers) {
      await this.notificationsService.notifyDriverOfNewOrder(
        driver.id,
        driver.userId,
        event.orderId,
        driver.distanceMeters,
      );
    }
  }
}
