import { registerEnumType } from '@nestjs/graphql';

export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
}

registerEnumType(DriverStatus, {
  name: 'DriverStatus',
  description: 'Driver availability status',
});
