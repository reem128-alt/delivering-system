import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriverModel } from './entities/driver.model';
import { NearestDriverModel } from './entities/nearest-driver.model';
import { CreateDriverInput } from './dto/create-driver.input';
import { UpdateDriverLocationInput } from './dto/update-driver-location.input';
import { UpdateDriverStatusInput } from './dto/update-driver-status.input';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GraphQLRolesGuard } from '../common/guards/graphql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Resolver(() => DriverModel)
export class DriversResolver {
  constructor(private readonly driversService: DriversService) {}

  @Mutation(() => DriverModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  createDriver(@Args('input') input: CreateDriverInput): Promise<DriverModel> {
    return this.driversService.create(input);
  }

  @Query(() => [DriverModel], { name: 'drivers' })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  findAll(): Promise<DriverModel[]> {
    return this.driversService.findAll();
  }

  @Query(() => DriverModel, { name: 'driver', nullable: true })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN', 'DRIVER')
  findOne(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<DriverModel | null> {
    return this.driversService.findOne(id);
  }

  @Query(() => DriverModel, { name: 'driverByUser', nullable: true })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN', 'DRIVER')
  findByUserId(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() user: User,
  ): Promise<DriverModel | null> {
    if (user.role !== 'ADMIN' && user.id !== userId) {
      throw new ForbiddenException(
        'You can only access your own driver profile',
      );
    }
    return this.driversService.findByUserId(userId);
  }

  @Query(() => [NearestDriverModel], { name: 'nearestDrivers' })
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('USER', 'ADMIN')
  findNearestDrivers(
    @Args('pickupLat') pickupLat: number,
    @Args('pickupLng') pickupLng: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<NearestDriverModel[]> {
    return this.driversService.findNearestDrivers(pickupLat, pickupLng, limit);
  }

  @Mutation(() => DriverModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('DRIVER')
  async updateDriverLocation(
    @Args('input') input: UpdateDriverLocationInput,
    @CurrentUser() user: User,
  ): Promise<DriverModel> {
    // Find the driver profile for the current user
    const userDriver = await this.driversService.findByUserId(user.id);
    if (!userDriver) {
      throw new ForbiddenException('Driver profile not found');
    }

    // Ensure the driver can only update their own location
    if (userDriver.id !== input.driverId) {
      throw new ForbiddenException('You can only update your own location');
    }

    return this.driversService.updateLocation(input);
  }

  @Mutation(() => DriverModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('DRIVER')
  async updateDriverStatus(
    @Args('input') input: UpdateDriverStatusInput,
    @CurrentUser() user: User,
  ): Promise<DriverModel> {
    // Find the driver profile for the current user
    const userDriver = await this.driversService.findByUserId(user.id);
    if (!userDriver) {
      throw new ForbiddenException('Driver profile not found');
    }

    // Ensure the driver can only update their own status
    if (userDriver.id !== input.driverId) {
      throw new ForbiddenException('You can only update your own status');
    }

    return this.driversService.updateStatus(input);
  }

  @Mutation(() => DriverModel)
  @UseGuards(JwtAuthGuard, GraphQLRolesGuard)
  @Roles('ADMIN')
  removeDriver(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<DriverModel> {
    return this.driversService.remove(id);
  }
}
