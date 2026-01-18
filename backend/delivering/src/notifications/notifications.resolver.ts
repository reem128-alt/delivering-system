import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';
import { ObjectType, Field } from '@nestjs/graphql';

// Notification model for GraphQL
@ObjectType()
export class NotificationModel {
  @Field(() => Int)
  id!: number;

  @Field(() => Int)
  userId!: number;

  @Field()
  type!: string;

  @Field()
  title!: string;

  @Field()
  message!: string;

  @Field({ nullable: true })
  data?: string;

  @Field()
  isRead!: boolean;

  @Field({ nullable: true })
  readAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@Resolver(() => NotificationModel)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => [NotificationModel], { name: 'userNotifications' })
  @UseGuards(JwtAuthGuard)
  async getUserNotifications(
    @Args('userId', { type: () => Int }) userId: number,
  ) {
    const result = await this.notificationsService.getUserNotifications(userId);
    return result.notifications;
  }

  @Query(() => [NotificationModel], { name: 'myNotifications' })
  @UseGuards(JwtAuthGuard)
  async getMyNotifications(@CurrentUser() user: User) {
    const result = await this.notificationsService.getUserNotifications(
      user.id,
      1, //page
      20, //limit
    );
    return result.notifications;
  }
}
