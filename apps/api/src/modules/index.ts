import { AuthModule } from './m01-auth/auth.module';
import { OrganisationModule } from './m02-organisation/organisation.module';
import { CourrierModule } from './m03-courrier/courrier.module';
import { ActesModule } from './m04-actes/actes.module';
import { CircuitModule } from './m05-circuit/circuit.module';
import { SignatureModule } from './m06-signature/signature.module';
import { DiffusionModule } from './m07-diffusion/diffusion.module';
import { RechercheModule } from './m08-recherche/recherche.module';
import { ArchivageModule } from './m09-archivage/archivage.module';
import { AuditModule } from './m10-audit/audit.module';
import { TableauDeBordModule } from './m11-tableau-de-bord/tableau-de-bord.module';
import { NotificationsModule } from './m12-notifications/notifications.module';
import { VerificationModule } from './m13-verification/verification.module';
import { GithubModule } from './m14-github/github.module';
import { AdminModule } from './m15-admin/admin.module';
import { DocumentsModule } from './documents/documents.module';

/** Les 15 modules fonctionnels du CDC + le pipeline documents. */
export const MODULES_METIER = [
  AuthModule,
  OrganisationModule,
  CourrierModule,
  ActesModule,
  CircuitModule,
  SignatureModule,
  DiffusionModule,
  RechercheModule,
  ArchivageModule,
  AuditModule,
  TableauDeBordModule,
  NotificationsModule,
  VerificationModule,
  GithubModule,
  AdminModule,
  DocumentsModule,
];
