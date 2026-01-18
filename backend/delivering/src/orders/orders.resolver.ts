import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderModel } from './entities/order.model';
import { CreateOrderInput } from './dto/create-order.input';
import { UpdateOrderStatusInput } from './dto/update-order-status.input';
import { AcceptOrderInput } from './dto/accept-order.input';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GraphQLRolesGuard } from '../common/guards/graphql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Resolver(() => OrderModel)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER')
  createOrder(@Args('input') input: CreateOrderInput): Promise<OrderModel> {
    return this.ordersService.create(input.userId, input);
  }

  @Query(() => [OrderModel], { name: 'orders' })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  findAll(): Promise<OrderModel[]> {
    return this.ordersService.findAll();
  }

  @Query(() => OrderModel, { name: 'order', nullable: true })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN', 'USER')
  findOne(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<OrderModel | null> {
    return this.ordersService.findOne(id);
  }

  @Query(() => [OrderModel], { name: 'myOrders' })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER')
  findMyOrders(@CurrentUser() user: User): Promise<OrderModel[]> {
    return this.ordersService.findByUser(user.id);
  }

  @Query(() => [OrderModel], { name: 'userOrders' })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  findUserOrders(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<OrderModel[]> {
    return this.ordersService.findByUser(userId);
  }

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  updateOrderStatus(
    @Args('input') input: UpdateOrderStatusInput,
  ): Promise<OrderModel> {
    return this.ordersService.updateStatus(input);
  }

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  removeOrder(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<OrderModel> {
    return this.ordersService.remove(id);
  }

  @Mutation(() => OrderModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('DRIVER')
  acceptOrder(@Args('input') input: AcceptOrderInput): Promise<OrderModel> {
    return this.ordersService.acceptOrder(input);
  }

  @Query(() => [OrderModel], { name: 'pendingOrders' })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN', 'DRIVER')
  findPendingOrders(): Promise<OrderModel[]> {
    return this.ordersService.findPendingOrders();
  }
}
