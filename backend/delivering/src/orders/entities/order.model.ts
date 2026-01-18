import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { OrderStatus } from '../enums/order-status.enum';

@ObjectType()
export class OrderModel {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => Int, { nullable: true })
  driverId?: number;

  @Field(() => OrderStatus)
  status!: OrderStatus;

  @Field(() => Float)
  price!: number;

  @Field(() => Int, { nullable: true })
  estimatedEta?: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
