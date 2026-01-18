import { InputType, Field, Float, Int } from '@nestjs/graphql';

@InputType()
export class UpdateDriverLocationInput {
  @Field(() => Int)
  driverId!: number;

  @Field(() => Float)
  lat!: number;

  @Field(() => Float)
  lng!: number;
}
