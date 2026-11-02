import { Module } from '@nestjs/common';
import { CircuitModule } from '../m05-circuit/circuit.module';
import { NotificationsService } from './notifications.service';

/**
 * M12 — Notifications
 * Exigences : BF-53, BF-54 · Priorité : P2 (volet e-mail avancé pour la démonstration)
 * Interface fournie : INotifier · Interfaces requises : IMessagerie, IParapheur
 */
@Module({ imports: [CircuitModule], providers: [NotificationsService] })
export class NotificationsModule {}
