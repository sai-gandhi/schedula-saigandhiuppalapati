import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment, AppointmentStatus } from '../appointments/appointment.entity';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './notification.entity';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    private notificationsService: NotificationsService,
  ) {}

  // ── Runs every hour ──────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async sendHourlyReminders() {
    this.logger.log('Running hourly appointment reminder job...');

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const date = now.toISOString().split('T')[0];
    const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
    const timeHour = `${String(oneHourLater.getHours()).padStart(2, '0')}:${String(oneHourLater.getMinutes()).padStart(2, '0')}:00`;

    const appointments = await this.appointmentRepo.find({
      where: {
        date,
        status: AppointmentStatus.BOOKED,
        reminderSent: false,
      },
      relations: { patient: true, doctor: true },
    });

    const upcoming = appointments.filter((appt) => {
      const start = appt.startTime.substring(0, 8);
      return start >= timeNow && start <= timeHour;
    });

    this.logger.log(`Found ${upcoming.length} appointments starting within 1 hour`);

    for (const appt of upcoming) {
      await this.notificationsService.createNotification(
        appt.patient,
        'Appointment Reminder',
        `Reminder: You have an appointment with ${appt.doctor.fullName} today at ${appt.startTime.substring(0, 5)}. Please be on time.`,
        NotificationType.APPOINTMENT_REMINDER,
      );

      appt.reminderSent = true;
      await this.appointmentRepo.save(appt);

      this.logger.log(`Reminder sent to ${appt.patient.fullName} for appointment at ${appt.startTime}`);
    }

    this.logger.log('Hourly reminder job completed');
  }

  // ── Runs once a day at 8:00 AM ───────────────────────────
  @Cron('0 8 * * *')
  async sendDailyReminders() {
    this.logger.log('Running daily appointment reminder job...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const appointments = await this.appointmentRepo.find({
      where: {
        date: tomorrowStr,
        status: AppointmentStatus.BOOKED,
      },
      relations: { patient: true, doctor: true },
    });

    this.logger.log(`Found ${appointments.length} appointments tomorrow`);

    for (const appt of appointments) {
      await this.notificationsService.createNotification(
        appt.patient,
        'Appointment Tomorrow',
        `Reminder: You have an appointment with ${appt.doctor.fullName} tomorrow (${tomorrowStr}) at ${appt.startTime.substring(0, 5)}.`,
        NotificationType.APPOINTMENT_REMINDER,
      );

      this.logger.log(`24hr reminder sent to ${appt.patient.fullName} for ${tomorrowStr}`);
    }

    this.logger.log('Daily reminder job completed');
  }
}