import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AuthorizePaymentDto {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;

  @Field(() => Boolean, { nullable: true })
  @IsString()
  @IsOptional()
  savePaymentMethod?: boolean;
}
