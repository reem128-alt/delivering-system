import { IsNumber, IsOptional } from 'class-validator';
import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CapturePaymentDto {
  @Field(() => Int, { nullable: true })
  @IsNumber()
  @IsOptional()
  amount?: number;
}
