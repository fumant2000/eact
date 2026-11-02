import { Module } from '@nestjs/common';
import { CircuitModule } from '../m05-circuit/circuit.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** M15 Administration et paramétrage — BF-64, BF-65 (BF-66 en P1), BF-06 à BF-08 côté admin, ENF-08. */
@Module({ imports: [CircuitModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
