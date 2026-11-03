import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AddressDto, UpdateAddressDto } from './dto/user.dto';
import { UpdateProfileDto } from '../auth/dto/auth.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Account')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.updateProfile(user.id, {});
  }

  @Patch('users/me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('addresses')
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.usersService.listAddresses(user.id);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.usersService.createAddress(user.id, dto);
  }

  @Patch('addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(user.id, id, dto);
  }

  @Patch('addresses/:id/default')
  setDefault(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.setDefaultAddress(user.id, id);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.deleteAddress(user.id, id);
  }

  @Get('notifications')
  listNotifications(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.usersService.listNotifications(
      user.id,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Patch('notifications/read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.usersService.markAllNotificationsRead(user.id);
  }

  @Patch('notifications/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.markNotificationRead(user.id, id);
  }
}
