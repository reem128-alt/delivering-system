import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class NearestDriverModel {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  status!: string;

  @Field(() => Float)
  distanceMeters!: number;
}
