-- AlterTable
ALTER TABLE "modele_acte" ADD COLUMN     "ampliations_defaut" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "version" TEXT NOT NULL DEFAULT '1.0';

-- AlterTable
ALTER TABLE "piece" ADD COLUMN     "motif_rejet" TEXT;
