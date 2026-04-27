import {
  Controller,
  NotFoundException,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserDto } from '../../auth/dto/user.dto';
import { ProfileGuard } from '../../auth/guards/profile.guard';
import { RequirePermission } from '../../auth/decorators/permission.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {

  constructor(
    private readonly usersService: UsersService,
    // @Inject('AUDIT_SERVICE') private readonly auditClient: ClientProxy // Placeholder for monolith integration
  ) { }

  @Get('me')
  async getProfile(@CurrentUser() user) {
    const foundUser = await this.usersService.findById(user.id);

    if (!foundUser) {
      throw new NotFoundException('User not found');
    }

    return new UserDto(foundUser);
  }

  @Get()
  // @UseGuards(ProfileGuard)
  // @RequirePermission('users_view')
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(user => new UserDto(user));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const foundUser = await this.usersService.findById(id);

    if (!foundUser) {
      throw new NotFoundException('User not found');
    }

    return new UserDto(foundUser);
  }

  @Patch(':id')
  // @UseGuards(ProfileGuard)
  // @RequirePermission('users_edit')
  async update(@Param('id') id: string, @Body() data: any, @Req() req) {
    console.log('🔧 PATCH /users/:id called');
    console.log('   id:', id);
    console.log('   data:', JSON.stringify(data));
    console.log('   adminId:', req.user?.id);
    return this.usersService.updateUser(id, data, req.user.id);
  }

  @Patch(':id/deactivate')
  @UseGuards(ProfileGuard)
  @RequirePermission('users_edit')
  async deactivate(@Param('id') id: string, @Req() req) {
    return this.usersService.updateUser(id, {
      status: 'inactive',
      deletedAt: new Date()
    }, req.user.id);
  }

  @Patch(':id/status')
  @UseGuards(ProfileGuard)
  @RequirePermission('users_edit')
  async changeStatus(@Param('id') id: string, @Body('status') status: string, @Req() req) {
    return this.usersService.updateUser(id, { status }, req.user.id);
  }

  @Delete(':id')
  @UseGuards(ProfileGuard)
  @RequirePermission('users_delete')
  async remove(@Param('id') id: string, @Req() req) {
    return this.usersService.remove(id, req.user.id);
  }

  @Get('audit-logs')
  @UseGuards(ProfileGuard)
  @RequirePermission('users_view')
  listLogs() {
    return { message: "Auditing will be integrated soon into the monolith" };
  }
}