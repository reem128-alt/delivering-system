import { InputType, Field, Int } from '@nestjs/graphql';
import { OrderStatus } from '../enums/order-status.enum';

@InputType()
export class UpdateOrderStatusInput {
  @Field(() => Int)
  orderId!: number;

  @Field(() => OrderStatus)
  status!: OrderStatus;

  @Field(() => Int, { nullable: true })
  driverId?: number;
}
