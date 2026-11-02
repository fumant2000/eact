import { Module } from '@nestjs/common';
import { CircuitService } from './circuit.service';

/**
 * M05 — Circuit de validation (parapheur électronique)
 * Exigences : BF-22 à BF-28 · Priorité : P0
 * Interface fournie : IParapheur
 */
@Module({ providers: [CircuitService], exports: [CircuitService] })
export class CircuitModule {}
