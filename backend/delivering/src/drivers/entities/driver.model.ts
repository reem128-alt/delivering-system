import { Field, ObjectType, Int } from '@nestjs/graphql';
import { DriverStatus } from '../enums/driver-status.enum';

@ObjectType()
export class DriverUserModel {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;

  @Field()
  name?: string;

  @Field()
  role!: string;
}

@ObjectType()
export class DriverModel {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field(() => DriverStatus)
  status!: DriverStatus;

  @Field()
  phone?: string;

  @Field()
  vehicleType?: string;

  @Field()
  licensePlate?: string;

  @Field(() => DriverUserModel, { nullable: true })
  user?: DriverUserModel;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
