import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, OrderStatus, User } from '@prisma/client';
import { PaymentEntity } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthorizePaymentDto } from './dto/authorize-payment.dto';
import { CapturePaymentDto } from './dto/capture-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { StripeProvider } from './providers/stripe.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private paymentProvider: StripeProvider,
  ) {}

  async createPayment(
    createPaymentDto: CreatePaymentDto,
    user?: User,
  ): Promise<PaymentEntity> {
    const {
      orderId,
      amount,
      currency = 'USD',
      provider,
      paymentMethodId,
    } = createPaymentDto;

    // Verify order exists and belongs to user
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // For non-admin users, verify order belongs to them
    if (user && user.role !== 'ADMIN' && order.userId !== user.id) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.payment) {
      throw new BadRequestException(`Order ${orderId} already has a payment`);
    }

    if (!paymentMethodId) {
      throw new BadRequestException('Payment method ID is required');
    }

    // Create payment intent with provider
    const paymentIntent = await this.paymentProvider.createPaymentIntent(
      amount,
      currency,
      orderId,
    );

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        amount,
        currency,
        provider,
        paymentMethod: paymentMethodId,
        status: PaymentStatus.PENDING,
        providerTxId: paymentIntent.id,
        platformFee: this.calculatePlatformFee(amount),
        driverAmount: this.calculateDriverAmount(amount),
      },
    });

    this.logger.log(`Created payment ${payment.id} for order ${orderId}`);

    // Return payment entity with client secret
    const paymentEntity = new PaymentEntity(payment);
    paymentEntity.clientSecret = paymentIntent.clientSecret || null;
    return paymentEntity;
  }

  async authorizePayment(
    paymentId: string,
    authorizePaymentDto: AuthorizePaymentDto,
    user?: User,
  ): Promise<PaymentEntity> {
    const { paymentMethodId } = authorizePaymentDto;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // For non-admin users, verify payment belongs to their order
    if (user && user.role !== 'ADMIN' && payment.order?.userId !== user.id) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Payment ${paymentId} is not in PENDING status`,
      );
    }

    // Use payment provider to confirm/authorize payment
    const confirmationResult = await this.paymentProvider.confirmPaymentIntent(
      payment.providerTxId || paymentId,
      paymentMethodId,
    );

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.AUTHORIZED,
        authorizationId: confirmationResult.authorizationId,
        providerTxId: confirmationResult.id,
        paymentMethod: paymentMethodId,
      },
    });

    // Update order status to PAYMENT_AUTHORIZED
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.PAYMENT_AUTHORIZED },
    });

    this.logger.log(
      `Authorized payment ${paymentId} with authorization ID ${confirmationResult.authorizationId}`,
    );
    return new PaymentEntity(updatedPayment);
  }

  async capturePayment(
    paymentId: string,
    capturePaymentDto: CapturePaymentDto,
    user?: User,
  ): Promise<PaymentEntity> {
    const { amount } = capturePaymentDto;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // For non-admin users, verify payment belongs to their order
    if (user && user.role !== 'ADMIN' && payment.order?.userId !== user.id) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.AUTHORIZED) {
      throw new BadRequestException(`Payment ${paymentId} is not authorized`);
    }

    const captureAmount = amount || payment.amount;

    if (captureAmount > payment.amount) {
      throw new BadRequestException(
        `Capture amount ${captureAmount} exceeds authorized amount ${payment.amount}`,
      );
    }

    // Use payment provider to capture payment
    const captureResult = await this.paymentProvider.capturePayment(
      payment.providerTxId || paymentId,
      captureAmount,
    );

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.CAPTURED,
        capturedAt: captureResult.capturedAt,
        captureAmount: captureResult.amountCaptured,
      },
    });

    this.logger.log(
      `Captured payment ${paymentId} for amount ${captureAmount}`,
    );
    return new PaymentEntity(updatedPayment);
  }

  async refundPayment(
    paymentId: string,
    refundPaymentDto: RefundPaymentDto,
  ): Promise<PaymentEntity> {
    const { amount, reason } = refundPaymentDto;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new BadRequestException(`Payment ${paymentId} is not captured`);
    }

    if (amount > (payment.captureAmount || payment.amount)) {
      throw new BadRequestException(
        `Refund amount ${amount} exceeds captured amount`,
      );
    }

    // Use payment provider to refund payment
    const refundResult = await this.paymentProvider.refundPayment(
      payment.providerTxId || paymentId,
      amount,
      reason,
    );

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundAmount: (payment.refundAmount || 0) + refundResult.amountRefunded,
        refundReason: refundResult.reason,
        refundedAt: refundResult.refundedAt,
      },
    });

    this.logger.log(
      `Refunded ${amount} for payment ${paymentId}. Reason: ${reason}`,
    );
    return new PaymentEntity(updatedPayment);
  }

  async getPaymentByOrderId(
    orderId: number,
    user?: User,
  ): Promise<PaymentEntity | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!payment) {
      return null;
    }

    // For non-admin users, verify payment belongs to their order
    if (user && user.role !== 'ADMIN' && payment.order?.userId !== user.id) {
      return null;
    }

    return new PaymentEntity(payment);
  }

  async getPaymentById(
    paymentId: string,
    user?: User,
  ): Promise<PaymentEntity | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      return null;
    }

    // For non-admin users, verify payment belongs to their order
    if (user && user.role !== 'ADMIN' && payment.order?.userId !== user.id) {
      return null;
    }

    return new PaymentEntity(payment);
  }

  private calculatePlatformFee(amount: number): number {
    // 10% platform fee
    return amount * 0.1;
  }

  private calculateDriverAmount(amount: number): number {
    // Driver gets 90% after platform fee
    return amount * 0.9;
  }
}
