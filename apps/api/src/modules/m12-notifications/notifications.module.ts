import { Module } from '@nestjs/common';

/**
 * M12 — Notifications
 * Exigences : BF-53 à BF-54 · Priorité : P2
 * Interface fournie : INotifier
 *
 * Organisation interne : *.controller.ts → *.service.ts → *.repository.ts
 * Règle : n'importer d'un autre module que son interface ou ses événements.
 */
@Module({})
export class NotificationsModule {}
