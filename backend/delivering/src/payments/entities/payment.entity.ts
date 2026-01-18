import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Payment, PaymentStatus } from '@prisma/client';

@ObjectType()
export class PaymentEntity implements Payment {
  @Field(() => String)
  id: string;

  @Field(() => Int)
  orderId: number;

  @Field(() => Int)
  amount: number;

  @Field(() => String)
  currency: string;

  @Field(() => String)
  status: PaymentStatus;

  @Field(() => String)
  provider: string;

  @Field(() => String, { nullable: true })
  providerTxId: string | null;

  @Field(() => String, { nullable: true })
  clientSecret: string | null;

  @Field(() => String, { nullable: true })
  paymentMethod: string | null;

  @Field(() => String, { nullable: true })
  authorizationId: string | null;

  @Field(() => Date, { nullable: true })
  capturedAt: Date | null;

  @Field(() => Int, { nullable: true })
  captureAmount: number | null;

  @Field(() => Int, { nullable: true })
  refundAmount: number | null;

  @Field(() => String, { nullable: true })
  refundReason: string | null;

  @Field(() => Date, { nullable: true })
  refundedAt: Date | null;

  @Field(() => Int, { nullable: true })
  platformFee: number | null;

  @Field(() => Int, { nullable: true })
  driverAmount: number | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  constructor(partial: Partial<PaymentEntity>) {
    Object.assign(this, partial);
  }

  static create(payment: Payment): PaymentEntity {
    return new PaymentEntity(payment);
  }
}
