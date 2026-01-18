import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, DriverStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderModel } from './entities/order.model';
import { CreateOrderInput } from './dto/create-order.input';
import { UpdateOrderStatusInput } from './dto/update-order-status.input';
import { AcceptOrderInput } from './dto/accept-order.input';
import { OrderCreatedEvent } from '../drivers/events/order-created.event';

@Injectable()
export class OrdersService {
  private static readonly AVERAGE_SPEED_KMH = 40;
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
  ) {}
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1); // Difference in latitude (radians)
    const dLng = this.toRad(lng2 - lng1); // Difference in longitude (radians)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance = radius × angle
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private calculateEstimatedEta(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
  ): number {
    const distanceKm = this.calculateDistance(
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
    );
    const etaMinutes = (distanceKm / OrdersService.AVERAGE_SPEED_KMH) * 60;
    return Math.ceil(etaMinutes + 5);
  } // time = distance / speed ,AVERAGE_SPEED_KMH = 40 ->* 60 convert to minute

  async create(userId: number, input: CreateOrderInput): Promise<OrderModel> {
    const estimatedEta =
      input.estimatedEta ??
      this.calculateEstimatedEta(
        input.pickupLat,
        input.pickupLng,
        input.dropoffLat,
        input.dropoffLng,
      );

    // Use raw SQL for geography fields like in driver service
    const order = await this.prisma.$queryRaw<Order[]>`
      INSERT INTO "Order" ("userId", status, "pickupLocation", "dropoffLocation", price, "estimatedEta", "createdAt", "updatedAt")
      VALUES (
        ${userId},
        'CREATED',
        ST_SetSRID(ST_MakePoint(${input.pickupLng}, ${input.pickupLat}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${input.dropoffLng}, ${input.dropoffLat}), 4326)::geography,
        ${input.price},
        ${estimatedEta},
        NOW(),
        NOW()
      )
      RETURNING id, "userId", status, price, "estimatedEta", "createdAt", "updatedAt"
    `;

    const createdOrder = order[0];

    // Emit event for driver service to handle
    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent(
        createdOrder.id,
        createdOrder.userId,
        input.pickupLat,
        input.pickupLng,
        input.dropoffLat,
        input.dropoffLng,
      ),
    );

    // Fallback: Directly update status to SEARCHING_DRIVER after a short delay
    // This ensures orders can be accepted even if event system fails
    setTimeout(() => {
      void (async () => {
        try {
          const currentOrder = await this.prisma.order.findUnique({
            where: { id: createdOrder.id },
          });

          if (currentOrder && currentOrder.status === OrderStatus.CREATED) {
            await this.prisma.order.update({
              where: { id: createdOrder.id },
              data: { status: OrderStatus.SEARCHING_DRIVER },
            });
            this.logger.log(
              `Order #${createdOrder.id} fallback: status updated to SEARCHING_DRIVER`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to update order #${createdOrder.id} status in fallback: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    }, 2000); // 2 second delay

    return {
      id: createdOrder.id,
      userId: createdOrder.userId,
      driverId: createdOrder.driverId ?? undefined,
      status: createdOrder.status,
      price: createdOrder.price,
      estimatedEta: createdOrder.estimatedEta ?? undefined,
      createdAt: createdOrder.createdAt,
      updatedAt: createdOrder.updatedAt,
    };
  }

  async findAll(): Promise<OrderModel[]> {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => ({
      id: o.id,
      userId: o.userId,
      driverId: o.driverId ?? undefined,
      status: o.status,
      price: o.price,
      estimatedEta: o.estimatedEta ?? undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  }

  async findOne(id: number): Promise<OrderModel | null> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) return null;

    return {
      id: order.id,
      userId: order.userId,
      driverId: order.driverId ?? undefined,
      status: order.status,
      price: order.price,
      estimatedEta: order.estimatedEta ?? undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async findByUser(userId: number): Promise<OrderModel[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((o) => ({
      id: o.id,
      userId: o.userId,
      driverId: o.driverId ?? undefined,
      status: o.status,
      price: o.price,
      estimatedEta: o.estimatedEta ?? undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  }

  async updateStatus(input: UpdateOrderStatusInput): Promise<OrderModel> {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order #${input.orderId} not found`);
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.CREATED]: [
        OrderStatus.SEARCHING_DRIVER,
        OrderStatus.CANCELED,
      ],
      [OrderStatus.PRICE_ESTIMATED]: [
        OrderStatus.PAYMENT_AUTHORIZED,
        OrderStatus.CANCELED,
      ],
      [OrderStatus.PAYMENT_AUTHORIZED]: [
        OrderStatus.SEARCHING_DRIVER,
        OrderStatus.CANCELED,
      ],
      [OrderStatus.SEARCHING_DRIVER]: [
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.CANCELED,
      ],
      [OrderStatus.DRIVER_ASSIGNED]: [
        OrderStatus.IN_PROGRESS,
        OrderStatus.CANCELED,
      ],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
      [OrderStatus.DELIVERED]: [OrderStatus.PAID],
      [OrderStatus.PAID]: [],
      [OrderStatus.CANCELED]: [],
    };

    const currentStatus = order.status;
    const allowedStatuses = validTransitions[currentStatus];

    if (!allowedStatuses.includes(input.status)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${input.status}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: input.orderId },
      data: {
        status: input.status,
        driverId: input.driverId,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      driverId: updated.driverId ?? undefined,
      status: updated.status,
      price: updated.price,
      estimatedEta: updated.estimatedEta ?? undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async acceptOrder(input: AcceptOrderInput): Promise<OrderModel> {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order #${input.orderId} not found`);
    }

    if (order.status !== OrderStatus.SEARCHING_DRIVER) {
      throw new ConflictException(
        `Order #${input.orderId} is not available for acceptance (status: ${order.status})`,
      );
    }

    if (order.driverId) {
      throw new ConflictException(
        `Order #${input.orderId} already accepted by another driver`,
      );
    }

    // Verify driver exists and is available
    const driver = await this.prisma.driver.findUnique({
      where: { id: input.driverId },
    });

    if (!driver) {
      throw new NotFoundException(`Driver #${input.driverId} not found`);
    }

    if (driver.status !== DriverStatus.AVAILABLE) {
      throw new ConflictException(
        `Driver #${input.driverId} is not available (status: ${driver.status})`,
      );
    }

    // Use transaction to ensure atomicity
    const [updatedOrder] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: input.orderId },
        data: {
          status: OrderStatus.DRIVER_ASSIGNED,
          driverId: input.driverId,
        },
      }),
      this.prisma.driver.update({
        where: { id: input.driverId },
        data: { status: DriverStatus.BUSY },
      }),
    ]);

    await this.notificationsService.notifyCustomerOrderStatus(
      order.userId,
      input.orderId,
      'accepted',
    );

    return {
      id: updatedOrder.id,
      userId: updatedOrder.userId,
      driverId: updatedOrder.driverId ?? undefined,
      status: updatedOrder.status,
      price: updatedOrder.price,
      estimatedEta: updatedOrder.estimatedEta ?? undefined,
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,
    };
  }

  async findPendingOrders(): Promise<OrderModel[]> {
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.SEARCHING_DRIVER },
      orderBy: { createdAt: 'asc' },
    });

    return orders.map((o) => ({
      id: o.id,
      userId: o.userId,
      driverId: o.driverId ?? undefined,
      status: o.status,
      price: o.price,
      estimatedEta: o.estimatedEta ?? undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  }

  async remove(id: number): Promise<OrderModel> {
    const order = await this.prisma.order.delete({ where: { id } });

    return {
      id: order.id,
      userId: order.userId,
      driverId: order.driverId ?? undefined,
      status: order.status,
      price: order.price,
      estimatedEta: order.estimatedEta ?? undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
/* toRad(deg) — Degrees to Radians
const R = 6371;  // Earth's radius in kilometers
a = square of half the chord length between the two points
c = angular distance in radians (central angle)


*/
