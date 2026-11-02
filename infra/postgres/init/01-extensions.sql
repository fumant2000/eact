-- Exécuté une seule fois à la création du volume (la migration init les crée aussi).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;   -- prévu : recherche insensible aux accents (BF-41)
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- prévu : recherche approchée sur l'objet et la référence
