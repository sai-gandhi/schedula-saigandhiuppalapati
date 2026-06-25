import {
  Controller, Get, Patch, Post,
  Param, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotificationsService } from './notifications.service';
import { ReminderService } from './reminder.service';
import { PatientService } from '../patient/patient.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('PATIENT')
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private patientService: PatientService,
    private reminderService: ReminderService,
  ) {}

  @Get()
  async getMyNotifications(@Request() req) {
    const patient = await this.patientService.findByUser(req.user);
    return this.notificationsService.getMyNotifications(patient);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const patient = await this.patientService.findByUser(req.user);
    return this.notificationsService.getUnreadCount(patient);
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req) {
    const patient = await this.patientService.findByUser(req.user);
    return this.notificationsService.markAllAsRead(patient);
  }

  @Patch(':id/read')
  async markAsRead(@Request() req, @Param('id') id: string) {
    const patient = await this.patientService.findByUser(req.user);
    return this.notificationsService.markAsRead(patient, id);
  }

  @Post('trigger-reminders')
  async triggerReminders() {
    await this.reminderService.sendHourlyReminders();
    return { message: 'Reminder job triggered manually' };
  }
}