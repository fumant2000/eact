-- À intégrer dans la première migration (prisma migrate dev --create-only puis coller ici).
-- ADR 0004 : journal en ajout seul.
CREATE OR REPLACE FUNCTION audit_interdit_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'evenement_audit est en ajout seul (BF-49)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evenement_audit_append_only
  BEFORE UPDATE OR DELETE ON evenement_audit
  FOR EACH ROW EXECUTE FUNCTION audit_interdit_modification();

-- Recherche plein texte FR/EN (BF-41) : colonne générée + index GIN.
ALTER TABLE acte ADD COLUMN recherche tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('french', coalesce(reference, '') || ' ' || objet), 'A') ||
  setweight(to_tsvector('french', contenu), 'B') ||
  setweight(to_tsvector('english', contenu), 'C')
) STORED;
CREATE INDEX acte_recherche_idx ON acte USING GIN (recherche);
