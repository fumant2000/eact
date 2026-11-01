-- Exécuté une seule fois à la création du volume.
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest() pour le chaînage d'audit
CREATE EXTENSION IF NOT EXISTS unaccent;   -- recherche plein texte FR/EN (BF-41)
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- recherche approchée sur l'objet et la référence
