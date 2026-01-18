import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { UserModel } from '../users/entities/user.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const isMatch = await bcrypt.compare(password, user.password);
    return isMatch ? user : null;
  }

  async login(loginInput: LoginInput) {
    const user = await this.validateUser(loginInput.email, loginInput.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const userModel: UserModel = {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return { accessToken, user: userModel };
  }

  async register(registerInput: RegisterInput) {
    const existing = await this.prisma.user.findUnique({
      where: { email: registerInput.email },
    });
    if (existing) {
      throw new UnauthorizedException('Email already in use');
    }
    const hashedPassword = await bcrypt.hash(registerInput.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: registerInput.email,
        password: hashedPassword,
        name: registerInput.name,
      },
    });
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const userModel: UserModel = {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return { accessToken, user: userModel };
  }
}
