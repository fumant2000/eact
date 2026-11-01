import { Controller, Get } from '@nestjs/common';

@Controller('v1/health')
export class HealthController {
  // Utilisé par Docker (healthcheck) et nginx pour retirer une instance défaillante.
  @Get()
  check() {
    return { status: 'ok', service: 'eact-api', time: new Date().toISOString() };
  }
}
