-- Extensions (aussi créées par infra/postgres/init, répétées ici pour la CI et les bases neuves)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "StatutActe" AS ENUM ('BROUILLON', 'EN_CIRCUIT', 'A_CORRIGER', 'REJETE', 'PRET_A_SIGNER', 'TRANSMIS', 'SIGNE', 'EXECUTOIRE', 'ARCHIVE', 'RETIRE');

-- CreateEnum
CREATE TYPE "Niveau" AS ENUM ('PUBLIC', 'INTERNE', 'CONFIDENTIEL');

-- CreateEnum
CREATE TYPE "DecisionVisa" AS ENUM ('FAVORABLE', 'CORRECTION', 'REJET');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AGENT_COURRIER', 'REDACTEUR', 'VISEUR', 'JURISTE', 'TRADUCTEUR', 'SECRETAIRE_GENERAL', 'AUTORITE_SIGNATAIRE', 'ARCHIVISTE', 'ADMINISTRATEUR', 'AUDITEUR');

-- CreateEnum
CREATE TYPE "ModePublicite" AS ENUM ('JOURNAL_OFFICIEL', 'PUBLICATION_OU_NOTIFICATION', 'NOTIFICATION', 'DIFFUSION', 'SITE_ET_PRESSE', 'REMISE');

-- CreateEnum
CREATE TYPE "Portee" AS ENUM ('REGLEMENTAIRE', 'INDIVIDUELLE');

-- CreateEnum
CREATE TYPE "MotifTransmission" AS ENUM ('PUBLICATION_JO', 'SIGNATURE_DECRET');

-- CreateEnum
CREATE TYPE "Langue" AS ENUM ('FR', 'EN');

-- CreateEnum
CREATE TYPE "TypeDelegation" AS ENUM ('SIGNATURE', 'INTERIM');

-- CreateEnum
CREATE TYPE "StatutAnalyse" AS ENUM ('EN_ATTENTE', 'SAINE', 'INFECTEE', 'REJETEE');

-- CreateTable
CREATE TABLE "structure" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" UUID NOT NULL,
    "matricule" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "totp_secret_chiffre" TEXT,
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "echecs_connexion" INTEGER NOT NULL DEFAULT 0,
    "verrouille_jusqua" TIMESTAMP(3),
    "structure_id" UUID NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur_role" (
    "utilisateur_id" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "utilisateur_role_pkey" PRIMARY KEY ("utilisateur_id","role")
);

-- CreateTable
CREATE TABLE "delegation" (
    "id" UUID NOT NULL,
    "type" "TypeDelegation" NOT NULL,
    "delegant_id" UUID NOT NULL,
    "delegataire_id" UUID NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "mention" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "type_acte" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "mode_publicite" "ModePublicite" NOT NULL,
    "signe_hors_ministere" BOOLEAN NOT NULL DEFAULT false,
    "duree_conservation_annees" INTEGER,
    "champs_obligatoires" JSONB NOT NULL DEFAULT '[]',
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "type_acte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modele_acte" (
    "id" UUID NOT NULL,
    "type_acte_id" UUID NOT NULL,
    "langue" "Langue" NOT NULL,
    "libelle" TEXT NOT NULL,
    "chemin_github" TEXT NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "contenu_cache" TEXT NOT NULL,
    "mis_a_jour_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modele_acte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circuit_validation" (
    "id" UUID NOT NULL,
    "type_acte_id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "circuit_validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etape_circuit" (
    "id" UUID NOT NULL,
    "circuit_id" UUID NOT NULL,
    "ordre" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "role_requis" "Role" NOT NULL,
    "delai_heures" INTEGER NOT NULL DEFAULT 48,

    CONSTRAINT "etape_circuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acte" (
    "id" UUID NOT NULL,
    "type_acte_id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "redacteur_id" UUID NOT NULL,
    "modele_id" UUID,
    "objet" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "langue" "Langue" NOT NULL DEFAULT 'FR',
    "traduction_requise" BOOLEAN NOT NULL DEFAULT false,
    "confidentialite" "Niveau" NOT NULL DEFAULT 'INTERNE',
    "portee" "Portee" NOT NULL DEFAULT 'INDIVIDUELLE',
    "statut" "StatutActe" NOT NULL DEFAULT 'BROUILLON',
    "etape_courante_id" UUID,
    "tour_circuit" INTEGER NOT NULL DEFAULT 1,
    "etape_entree_le" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "reference" TEXT,
    "annee" INTEGER,
    "sequence" INTEGER,
    "signataire_id" UUID,
    "delegation_id" UUID,
    "signe_le" TIMESTAMP(3),
    "empreinte_sha256" TEXT,
    "code_verification" TEXT,
    "chemin_pdf" TEXT,
    "reference_externe" TEXT,
    "acte_initial_id" UUID,
    "recherche" tsvector,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mis_a_jour_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_acte" (
    "id" UUID NOT NULL,
    "acte_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "auteur_id" UUID NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_acte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piece" (
    "id" UUID NOT NULL,
    "acte_id" UUID NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "type_mime" TEXT NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "chemin_objet" TEXT NOT NULL,
    "empreinte_sha256" TEXT,
    "statut_analyse" "StatutAnalyse" NOT NULL DEFAULT 'EN_ATTENTE',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa" (
    "id" UUID NOT NULL,
    "acte_id" UUID NOT NULL,
    "etape_id" UUID NOT NULL,
    "viseur_id" UUID NOT NULL,
    "tour_circuit" INTEGER NOT NULL,
    "decision" "DecisionVisa" NOT NULL,
    "observation" TEXT,
    "etape_retour" INTEGER,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compteur_numerotation" (
    "type_acte_id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "compteur_numerotation_pkey" PRIMARY KEY ("type_acte_id","structure_id","annee")
);

-- CreateTable
CREATE TABLE "cle_idempotence" (
    "cle" TEXT NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "statut_http" INTEGER NOT NULL,
    "reponse" JSONB NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cle_idempotence_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "destinataire" (
    "id" UUID NOT NULL,
    "acte_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "email" TEXT,
    "interne" BOOLEAN NOT NULL DEFAULT true,
    "notifie_le" TIMESTAMP(3),

    CONSTRAINT "destinataire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmission_externe" (
    "id" UUID NOT NULL,
    "acte_id" UUID NOT NULL,
    "motif" "MotifTransmission" NOT NULL,
    "destinataire" TEXT NOT NULL,
    "transmis_le" TIMESTAMP(3) NOT NULL,
    "bordereau" TEXT NOT NULL,
    "accuse_reception_le" TIMESTAMP(3),

    CONSTRAINT "transmission_externe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenement_audit" (
    "id" BIGSERIAL NOT NULL,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acteur_id" UUID,
    "action" TEXT NOT NULL,
    "ressource_type" TEXT NOT NULL,
    "ressource_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "hash_precedent" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "evenement_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rapport_anomalie" (
    "id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "version_app" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'TRANSMIS',
    "issue_numero" INTEGER,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rapport_anomalie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametre" (
    "cle" TEXT NOT NULL,
    "valeur_chiffree" TEXT NOT NULL,
    "mis_a_jour_le" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametre_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE UNIQUE INDEX "structure_code_key" ON "structure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_matricule_key" ON "utilisateur"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "delegation_delegataire_id_debut_fin_idx" ON "delegation"("delegataire_id", "debut", "fin");

-- CreateIndex
CREATE UNIQUE INDEX "type_acte_code_key" ON "type_acte"("code");

-- CreateIndex
CREATE UNIQUE INDEX "modele_acte_type_acte_id_langue_chemin_github_key" ON "modele_acte"("type_acte_id", "langue", "chemin_github");

-- CreateIndex
CREATE UNIQUE INDEX "circuit_validation_type_acte_id_structure_id_key" ON "circuit_validation"("type_acte_id", "structure_id");

-- CreateIndex
CREATE UNIQUE INDEX "etape_circuit_circuit_id_ordre_key" ON "etape_circuit"("circuit_id", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "acte_reference_key" ON "acte"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "acte_code_verification_key" ON "acte"("code_verification");

-- CreateIndex
CREATE INDEX "acte_statut_etape_courante_id_idx" ON "acte"("statut", "etape_courante_id");

-- CreateIndex
CREATE INDEX "acte_recherche_idx" ON "acte" USING GIN ("recherche");

-- CreateIndex
CREATE UNIQUE INDEX "acte_type_acte_id_structure_id_annee_sequence_key" ON "acte"("type_acte_id", "structure_id", "annee", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "version_acte_acte_id_numero_key" ON "version_acte"("acte_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "visa_acte_id_etape_id_viseur_id_tour_circuit_key" ON "visa"("acte_id", "etape_id", "viseur_id", "tour_circuit");

-- CreateIndex
CREATE UNIQUE INDEX "evenement_audit_hash_key" ON "evenement_audit"("hash");

-- CreateIndex
CREATE INDEX "evenement_audit_ressource_type_ressource_id_idx" ON "evenement_audit"("ressource_type", "ressource_id");

-- CreateIndex
CREATE UNIQUE INDEX "rapport_anomalie_issue_numero_key" ON "rapport_anomalie"("issue_numero");

-- AddForeignKey
ALTER TABLE "structure" ADD CONSTRAINT "structure_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "structure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisateur_role" ADD CONSTRAINT "utilisateur_role_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation" ADD CONSTRAINT "delegation_delegant_id_fkey" FOREIGN KEY ("delegant_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation" ADD CONSTRAINT "delegation_delegataire_id_fkey" FOREIGN KEY ("delegataire_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modele_acte" ADD CONSTRAINT "modele_acte_type_acte_id_fkey" FOREIGN KEY ("type_acte_id") REFERENCES "type_acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_validation" ADD CONSTRAINT "circuit_validation_type_acte_id_fkey" FOREIGN KEY ("type_acte_id") REFERENCES "type_acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circuit_validation" ADD CONSTRAINT "circuit_validation_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etape_circuit" ADD CONSTRAINT "etape_circuit_circuit_id_fkey" FOREIGN KEY ("circuit_id") REFERENCES "circuit_validation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_type_acte_id_fkey" FOREIGN KEY ("type_acte_id") REFERENCES "type_acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_redacteur_id_fkey" FOREIGN KEY ("redacteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_signataire_id_fkey" FOREIGN KEY ("signataire_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_delegation_id_fkey" FOREIGN KEY ("delegation_id") REFERENCES "delegation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_modele_id_fkey" FOREIGN KEY ("modele_id") REFERENCES "modele_acte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_etape_courante_id_fkey" FOREIGN KEY ("etape_courante_id") REFERENCES "etape_circuit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acte" ADD CONSTRAINT "acte_acte_initial_id_fkey" FOREIGN KEY ("acte_initial_id") REFERENCES "acte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_acte" ADD CONSTRAINT "version_acte_acte_id_fkey" FOREIGN KEY ("acte_id") REFERENCES "acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piece" ADD CONSTRAINT "piece_acte_id_fkey" FOREIGN KEY ("acte_id") REFERENCES "acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa" ADD CONSTRAINT "visa_acte_id_fkey" FOREIGN KEY ("acte_id") REFERENCES "acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa" ADD CONSTRAINT "visa_etape_id_fkey" FOREIGN KEY ("etape_id") REFERENCES "etape_circuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa" ADD CONSTRAINT "visa_viseur_id_fkey" FOREIGN KEY ("viseur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compteur_numerotation" ADD CONSTRAINT "compteur_numerotation_type_acte_id_fkey" FOREIGN KEY ("type_acte_id") REFERENCES "type_acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compteur_numerotation" ADD CONSTRAINT "compteur_numerotation_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destinataire" ADD CONSTRAINT "destinataire_acte_id_fkey" FOREIGN KEY ("acte_id") REFERENCES "acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmission_externe" ADD CONSTRAINT "transmission_externe_acte_id_fkey" FOREIGN KEY ("acte_id") REFERENCES "acte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── Compléments hors Prisma ─────────────

-- ADR 0004 / BF-49 : journal d'audit en ajout seul.
CREATE OR REPLACE FUNCTION audit_interdit_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'evenement_audit est en ajout seul (BF-49)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evenement_audit_append_only
  BEFORE UPDATE OR DELETE ON "evenement_audit"
  FOR EACH ROW EXECUTE FUNCTION audit_interdit_modification();

-- BF-41 : recherche plein texte FR/EN, colonne déclarée dans Prisma (Unsupported tsvector).
CREATE OR REPLACE FUNCTION acte_maj_recherche() RETURNS trigger AS $$
BEGIN
  NEW."recherche" :=
    setweight(to_tsvector('french', coalesce(NEW."reference", '') || ' ' || NEW."objet"), 'A') ||
    setweight(to_tsvector('french', NEW."contenu"), 'B') ||
    setweight(to_tsvector('english', NEW."contenu"), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER acte_recherche_maj
  BEFORE INSERT OR UPDATE OF "reference", "objet", "contenu" ON "acte"
  FOR EACH ROW EXECUTE FUNCTION acte_maj_recherche();
