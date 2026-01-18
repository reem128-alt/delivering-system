import { InputType, Field, Int } from '@nestjs/graphql';
import { DriverStatus } from '../enums/driver-status.enum';

@InputType()
export class UpdateDriverStatusInput {
  @Field(() => Int)
  driverId!: number;

  @Field(() => DriverStatus)
  status!: DriverStatus;
}

export { DriverStatus };
