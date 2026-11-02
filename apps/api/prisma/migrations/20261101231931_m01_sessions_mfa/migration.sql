-- AlterTable
ALTER TABLE "delegation" ADD COLUMN     "perimetre" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "codes_secours" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "telephone" TEXT,
ADD COLUMN     "totp_active" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "session_utilisateur" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "empreinte_jeton" TEXT NOT NULL,
    "mfa_verifie_le" TIMESTAMP(3),
    "derniere_activite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoque_le" TIMESTAMP(3),
    "adresse_ip" TEXT,

    CONSTRAINT "session_utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jeton_reinitialisation" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "empreinte_jeton" TEXT NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "utilise_le" TIMESTAMP(3),
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jeton_reinitialisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_utilisateur_empreinte_jeton_key" ON "session_utilisateur"("empreinte_jeton");

-- CreateIndex
CREATE INDEX "session_utilisateur_utilisateur_id_idx" ON "session_utilisateur"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "jeton_reinitialisation_empreinte_jeton_key" ON "jeton_reinitialisation"("empreinte_jeton");

-- AddForeignKey
ALTER TABLE "session_utilisateur" ADD CONSTRAINT "session_utilisateur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jeton_reinitialisation" ADD CONSTRAINT "jeton_reinitialisation_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
