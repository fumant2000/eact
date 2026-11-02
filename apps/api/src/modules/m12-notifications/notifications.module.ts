import { Module } from '@nestjs/common';
import { CircuitModule } from '../m05-circuit/circuit.module';
import { NotificationsService } from './notifications.service';

/** M12 Notifications — BF-53, BF-54 (P2, volet e-mail seulement). */
@Module({ imports: [CircuitModule], providers: [NotificationsService] })
export class NotificationsModule {}
