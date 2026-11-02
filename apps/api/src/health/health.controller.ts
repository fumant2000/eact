import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/security/securite';

@Controller('v1/health')
export class HealthController {
  // Utilisé par Docker (healthcheck) et nginx pour retirer une instance défaillante.
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'eact-api', time: new Date().toISOString() };
  }
}
