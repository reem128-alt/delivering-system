import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserModel } from './entities/user.model';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GraphQLRolesGuard } from '../common/guards/graphql-roles.guard';
import type { User, UserRole } from '@prisma/client';

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserModel], { name: 'users' })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.usersService.findAll();
  }

  @Query(() => UserModel, { name: 'user', nullable: true })
  @UseGuards(JwtAuthGuard)
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.usersService.findOne(id);
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  updateUser(
    @Args('id', { type: () => Int }) id: number,
    @Args('name', { nullable: true }) name?: string,
    @Args('role', { nullable: true }) role?: string,
  ) {
    const validRoles: UserRole[] = ['USER', 'DRIVER', 'ADMIN'];
    const validatedRole =
      role && validRoles.includes(role as UserRole)
        ? (role as UserRole)
        : undefined;
    return this.usersService.update(id, { name, role: validatedRole });
  }

  @Mutation(() => UserModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  removeUser(@Args('id', { type: () => Int }) id: number) {
    return this.usersService.remove(id);
  }

  @Query(() => UserModel, { name: 'me' })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User): UserModel {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
