-- ADR 0004 : TRUNCATE ne déclenche pas les triggers de ligne ; on le bloque au niveau de l'instruction.
CREATE TRIGGER evenement_audit_no_truncate
  BEFORE TRUNCATE ON "evenement_audit"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_interdit_modification();
