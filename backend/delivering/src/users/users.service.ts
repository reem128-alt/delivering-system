import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { UserModel } from './entities/user.model';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserModel[]> {
    const users = await this.prisma.user.findMany();
    return users.map(
      (u): UserModel => ({
        id: u.id,
        email: u.email,
        name: u.name ?? undefined,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }),
    );
  }

  async findOne(id: number): Promise<UserModel | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(
    id: number,
    data: Partial<Pick<User, 'name' | 'role'>>,
  ): Promise<UserModel> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async remove(id: number): Promise<UserModel> {
    const user = await this.prisma.user.delete({ where: { id } });
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
