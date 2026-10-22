import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const SAFE_SELECT = {
  id: true,
  userName: true,
  firstName: true,
  lastName: true,
  urlPhoto: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.client.user.findMany({
      where: { isDeleted: false },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: SAFE_SELECT,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, isDeleted: false },
      select: SAFE_SELECT,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const exists = await this.prisma.client.user.findUnique({
      where: { userName: dto.userName },
    });
    if (exists) throw new ConflictException('El nombre de usuario ya existe');
    return this.prisma.client.user.create({
      data: {
        ...dto,
        password: await argon2.hash(dto.password),
        createdBy: actorId,
      },
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    await this.findOne(id);
    if (dto.userName) {
      const other = await this.prisma.client.user.findFirst({
        where: { userName: dto.userName, NOT: { id } },
      });
      if (other) throw new ConflictException('El nombre de usuario ya existe');
    }
    return this.prisma.client.user.update({
      where: { id },
      data: { ...dto, updatedBy: actorId },
      select: SAFE_SELECT,
    });
  }

  async resetPassword(id: string, newPassword: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.client.user.update({
      where: { id },
      data: {
        password: await argon2.hash(newPassword),
        refreshToken: null,
        updatedBy: actorId,
      },
    });
    return { success: true };
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    // Libera el user_name (unique) para poder reutilizarlo y cierra sesiones.
    await this.prisma.client.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: actorId,
        refreshToken: null,
        userName: `deleted_${Date.now()}_${id.slice(0, 8)}`,
      },
    });
    return { success: true };
  }
}
