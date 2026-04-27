import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('profiles') // Padronizado para o plural conforme o REST
@UseGuards(JwtAuthGuard)
export class ProfileController {
  private readonly logger = new Logger('ProfileController');

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    this.logger.log('Fetching active profiles...');

    // Substituição do TypeORM pelo Prisma Client
    const profiles = await this.prisma.profile.findMany({
      where: { 
        isActive: true 
      },
      select: { 
        id: true, 
        name: true, 
        permissions: true 
      },
      orderBy: { 
        name: 'asc' 
      },
    });

    return profiles;
  }
}