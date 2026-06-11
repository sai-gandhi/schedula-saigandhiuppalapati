import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return 'Schedula API is running successfully! 🚀 | Developer: Uppalapati Sai Gandhi';
  }
}