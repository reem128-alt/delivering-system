import { registerEnumType } from '@nestjs/graphql';
import { OrderStatus as PrismaOrderStatus } from '@prisma/client';

registerEnumType(PrismaOrderStatus, {
  name: 'OrderStatus',
  description: 'Lifecycle state of a delivery order',
});

export { PrismaOrderStatus as OrderStatus };
