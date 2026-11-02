import { Module } from '@nestjs/common';
import { CircuitModule } from '../m05-circuit/circuit.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * M15 — Administration et paramétrage
 * Exigences : BF-64, BF-65 (P0), BF-66 (P1) ; M02 côté administrateur : BF-06 à BF-08
 * ENF-08 : types, circuits et structures s'ajoutent par paramétrage, sans modifier le code.
 */
@Module({ imports: [CircuitModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
