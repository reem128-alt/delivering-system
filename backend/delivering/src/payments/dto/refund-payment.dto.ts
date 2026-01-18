import { IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class RefundPaymentDto {
  @Field(() => Int)
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
