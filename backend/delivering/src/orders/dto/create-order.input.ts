import { InputType, Field, Float, Int } from '@nestjs/graphql';

@InputType()
export class CreateOrderInput {
  @Field(() => Int)
  userId!: number;

  @Field(() => Float)
  pickupLat!: number;

  @Field(() => Float)
  pickupLng!: number;

  @Field(() => Float)
  dropoffLat!: number;

  @Field(() => Float)
  dropoffLng!: number;

  @Field(() => Float)
  price!: number;

  @Field({ nullable: true })
  estimatedEta?: number;
}
