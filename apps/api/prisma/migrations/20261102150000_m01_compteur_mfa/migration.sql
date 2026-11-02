-- BF-02 / RG-12 : compteur des codes TOTP faux, distinct de celui des mots de passe.
ALTER TABLE "utilisateur" ADD COLUMN "echecs_mfa" INTEGER NOT NULL DEFAULT 0;
