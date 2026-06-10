import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return {
      message: 'Schedula API is running successfully! 🚀',
      status: 'OK',
      version: '1.0.0',
      endpoints: {
        auth: '/auth/signup, /auth/login',
        doctor: '/doctor, /doctor/:id, /doctor/profile',
        patient: '/patient/profile',
      },
    };
  }
}
