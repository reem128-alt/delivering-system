import { InputType, Field, Float } from '@nestjs/graphql';
import { DriverStatus } from '../enums/driver-status.enum';

@InputType()
export class CreateDriverInput {
  // User details
  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field()
  name!: string;

  // Driver details
  @Field()
  phone!: string;

  @Field()
  vehicleType!: string;

  @Field()
  licensePlate!: string;

  @Field(() => DriverStatus, { nullable: true })
  status?: DriverStatus;

  @Field(() => Float)
  lat!: number;

  @Field(() => Float)
  lng!: number;
}
