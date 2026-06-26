import {
  Injectable, NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { PatientProfile } from '../patient/patient.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  // ── Internal: create notification (called by other services) ─

  async createNotification(
    patient: PatientProfile,
    title: string,
    message: string,
    type: NotificationType,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      patient,
      title,
      message,
      type,
      isRead: false,
    });
    return this.notificationRepo.save(notification);
  }

  // ── GET /notifications ────────────────────────────────────

  async getMyNotifications(patient: PatientProfile): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { patient: { id: patient.id } },
      order: { createdAt: 'DESC' },
    });
  }

  // ── PATCH /notifications/:id/read ─────────────────────────

  async markAsRead(
    patient: PatientProfile,
    id: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
      relations: { patient: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.patient.id !== patient.id) {
      throw new ForbiddenException(
        'You can only read your own notifications',
      );
    }

    if (notification.isRead) {
      return notification;
    }

    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }

  // ── PATCH /notifications/read-all ─────────────────────────

  async markAllAsRead(patient: PatientProfile): Promise<{ updated: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('patientId = :patientId', { patientId: patient.id })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();

    return { updated: result.affected || 0 };
  }

  // ── GET /notifications/unread-count ───────────────────────

  async getUnreadCount(patient: PatientProfile): Promise<{ count: number }> {
    const count = await this.notificationRepo.count({
      where: {
        patient: { id: patient.id },
        isRead: false,
      },
    });

    return { count };
  }
}