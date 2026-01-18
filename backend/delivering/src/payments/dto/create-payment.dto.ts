import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';
import { PaymentStatus } from '@prisma/client';

@InputType()
export class CreatePaymentDto {
  @Field(() => Int)
  @IsNumber()
  @IsNotEmpty()
  orderId!: number;

  @Field(() => Int)
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  currency?: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;

  @Field(() => String, { nullable: true })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;
}
