import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class AcceptOrderInput {
  @Field(() => Int)
  orderId!: number;

  @Field(() => Int)
  driverId!: number;
}
