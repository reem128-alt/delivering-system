import { Field, ObjectType, Int } from '@nestjs/graphql';
import { UserRole } from '@prisma/client';

@ObjectType()
export class UserModel {
  @Field(() => Int)
  id!: number;

  @Field()
  email!: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => String)
  role!: UserRole;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
