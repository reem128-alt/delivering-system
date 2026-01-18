import { Resolver, Mutation, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentEntity } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthorizePaymentDto } from './dto/authorize-payment.dto';
import { CapturePaymentDto } from './dto/capture-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GraphQLRolesGuard } from '../common/guards/graphql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Resolver(() => PaymentEntity)
export class PaymentsResolver {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Mutation(() => PaymentEntity)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER', 'ADMIN')
  async createPayment(
    @Args('createPaymentDto') createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.createPayment(createPaymentDto, user);
  }

  @Mutation(() => PaymentEntity)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER', 'ADMIN')
  async authorizePayment(
    @Args('paymentId') paymentId: string,
    @Args('authorizePaymentDto') authorizePaymentDto: AuthorizePaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.authorizePayment(
      paymentId,
      authorizePaymentDto,
      user,
    );
  }

  @Mutation(() => PaymentEntity)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER', 'ADMIN')
  async capturePayment(
    @Args('paymentId') paymentId: string,
    @Args('capturePaymentDto') capturePaymentDto: CapturePaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.capturePayment(
      paymentId,
      capturePaymentDto,
      user,
    );
  }

  @Mutation(() => PaymentEntity)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  async refundPayment(
    @Args('paymentId') paymentId: string,
    @Args('refundPaymentDto') refundPaymentDto: RefundPaymentDto,
  ) {
    return this.paymentsService.refundPayment(paymentId, refundPaymentDto);
  }

  @Query(() => PaymentEntity, { nullable: true })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER', 'ADMIN')
  async payment(
    @Args('paymentId') paymentId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.getPaymentById(paymentId, user);
  }

  @Query(() => PaymentEntity, { nullable: true })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER', 'ADMIN')
  async paymentByOrder(
    @Args('orderId', { type: () => Int }) orderId: number,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.getPaymentByOrderId(orderId, user);
  }
}
