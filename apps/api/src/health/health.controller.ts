import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/security/securite';

@Controller('v1/health')
export class HealthController {
  // Sonde de santé (healthcheck Docker, nginx).
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'eact-api', time: new Date().toISOString() };
  }
}
