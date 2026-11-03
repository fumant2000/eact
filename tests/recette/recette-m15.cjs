// Recette M15 / M02 administration (BF-06 à BF-08, BF-64, BF-65, ENF-08).
const API = process.env.EACT_API ?? 'http://localhost:3000';
const MAILPIT = process.env.EACT_MAILPIT ?? 'http://localhost:8025/api/v1';
let ok = 0, ko = 0;
const verifier = (nom, cond, info = '') => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO '} ${nom}${info !== '' ? ' — ' + info : ''}`); };
const suffixe = Date.now().toString(36).toUpperCase().slice(-5);

async function session(matricule) {
  const jar = {};
  const appel = async (methode, chemin, corps) => {
    const r = await fetch(API + chemin, { method: methode, headers: { ...(corps ? { 'content-type': 'application/json' } : {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: corps ? JSON.stringify(corps) : undefined });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); jar[k] = v.join('='); }
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const r = await appel('POST', '/v1/auth/demo/connexion', { matricule }); // mode démo : connexion en un clic
  if (r.body?.etape !== 'CONNECTE') throw new Error(matricule + ' ' + JSON.stringify(r.body));
  return appel;
}

(async () => {
  const admin = await session('MINESUP-02019');
  const red = await session('MINESUP-04812');
  verifier('RBAC : la rédactrice n’accède pas à l’administration', (await red('GET', '/v1/admin/types')).status === 403);

  let types = (await admin('GET', '/v1/admin/types')).body;
  const ns = types.find((t) => t.code === 'NS');
  const am = types.find((t) => t.code === 'AM');
  verifier('J4 types avec circuits et étapes', ns.circuits[0]?.etapes.length >= 3 && ns.circuits[0].etapes[0].utilisee !== undefined);

  // BF-64
  let r = await admin('PATCH', `/v1/admin/types/${am.id}`, { champsObligatoires: ['objet', 'contenu', 'inconnu'] });
  verifier('champ obligatoire inconnu refusé', r.status === 422);
  r = await admin('PATCH', `/v1/admin/types/${am.id}`, { champsObligatoires: ['objet', 'contenu', 'ampliation'], dureeConservationAnnees: null });
  verifier('BF-64 type modifié', r.status === 204);

  // ENF-08 : un circuit pour l'arrêté, sans code
  const structures = (await admin('GET', '/v1/admin/structures')).body;
  const dag = structures.find((s) => s.code === 'DAG');
  const avant = (await red('GET', '/v1/types-actes')).body.find((t) => t.code === 'AM');
  let circuitAm = am.circuits.find((c) => c.structure.id === dag.id);
  if (!circuitAm) {
    r = await admin('POST', '/v1/admin/circuits', {
      typeActeId: am.id,
      structureId: dag.id,
      etapes: [
        { libelle: 'Visa du chef de service', roleRequis: 'VISEUR', delaiHeures: 48 },
        { libelle: 'Visa du directeur', roleRequis: 'VISEUR', delaiHeures: 48 },
        { libelle: 'Contrôle juridique', roleRequis: 'JURISTE', delaiHeures: 72 },
        { libelle: 'Visa du Secrétaire Général', roleRequis: 'SECRETAIRE_GENERAL', delaiHeures: 48 },
      ],
    });
    verifier('BF-65 circuit de l’arrêté ministériel créé', r.status === 201);
  } else verifier('BF-65 circuit de l’arrêté déjà présent', true);
  const apres = (await red('GET', '/v1/types-actes')).body.find((t) => t.code === 'AM');
  verifier('ENF-08 l’arrêté devient rédigeable sans toucher au code', apres.nbEtapes >= 4, `avant ${avant.nbEtapes ?? 'aucun circuit'} → ${apres.nbEtapes} étapes`);
  r = await admin('POST', '/v1/admin/circuits', { typeActeId: am.id, structureId: dag.id, etapes: [{ libelle: 'x x x', roleRequis: 'VISEUR', delaiHeures: 1 }] });
  verifier('doublon type × structure → 409', r.status === 409);

  // Étapes
  types = (await admin('GET', '/v1/admin/types')).body;
  circuitAm = types.find((t) => t.code === 'AM').circuits.find((c) => c.structure.id === dag.id);
  r = await admin('POST', `/v1/admin/circuits/${circuitAm.id}/etapes`, { libelle: 'Traduction', roleRequis: 'TRADUCTEUR', delaiHeures: 72 });
  const idEtape = r.body?.id;
  verifier('étape ajoutée en fin de circuit', r.status === 201);
  verifier('délai modifié', (await admin('PATCH', `/v1/admin/etapes/${idEtape}`, { delaiHeures: 96 })).status === 204);
  verifier('étape inutilisée supprimée', (await admin('DELETE', `/v1/admin/etapes/${idEtape}`)).status === 204);
  const etapeNsUtilisee = ns.circuits[0].etapes.find((e) => e.utilisee);
  if (etapeNsUtilisee) verifier('étape déjà utilisée : suppression refusée', (await admin('DELETE', `/v1/admin/etapes/${etapeNsUtilisee.id}`)).body?.code === 'ETAPE_UTILISEE');

  // Désactivation sans suppression : les nouveaux actes sont bloqués, ceux déjà en circuit vont au bout
  const marie = await session('MINESUP-02845');
  const creerAm = () => red('POST', '/v1/actes', { typeActeId: am.id });
  const enCours = (await creerAm()).body.id;
  let a = (await red('GET', `/v1/actes/${enCours}`)).body;
  a = (await red('PATCH', `/v1/actes/${enCours}`, { version: a.version, objet: 'portant désactivation de test', contenu: '<p><strong>Article 1er.</strong> Test.</p>', ampliations: ['SG'] })).body;
  r = await red('POST', `/v1/actes/${enCours}/soumission`, { version: a.version });
  verifier('acte AM soumis avant la désactivation', r.status === 200 && r.body.etape?.ordre === 1);
  const brouillon = (await creerAm()).body.id;

  r = await admin('PATCH', `/v1/admin/circuits/${circuitAm.id}`, { actif: false });
  verifier('circuit désactivé (acte en cours compté)', r.status === 200 && r.body.actif === false && r.body.actesEnCours >= 1, `${r.body?.actesEnCours} en cours`);
  verifier('circuit désactivé : l’arrêté n’est plus rédigeable', (await red('GET', '/v1/types-actes')).body.find((t) => t.code === 'AM').nbEtapes === null);
  verifier('circuit désactivé : nouvel acte refusé', (await creerAm()).body?.code === 'CIRCUIT_ABSENT');
  a = (await red('GET', `/v1/actes/${brouillon}`)).body;
  r = await red('POST', `/v1/actes/${brouillon}/soumission`, { version: a.version });
  verifier('circuit désactivé : brouillon non soumissible', r.status === 422 && r.body.code === 'CIRCUIT_INACTIF');
  const suivi = (await marie('GET', `/v1/actes/${enCours}/suivi`)).body;
  verifier('acte en cours : frise du circuit conservée, visa possible', suivi?.etapes?.length === 4 && suivi.peutViser === true);
  a = (await marie('GET', `/v1/actes/${enCours}`)).body;
  r = await marie('POST', `/v1/actes/${enCours}/visas`, { decision: 'FAVORABLE', version: a.version });
  verifier('acte en cours : il continue son circuit', r.status === 200 && r.body.etape?.ordre === 2, r.body?.etape?.libelle);
  r = await admin('PATCH', `/v1/admin/circuits/${circuitAm.id}`, { actif: true });
  verifier('circuit réactivé : l’arrêté redevient rédigeable', r.status === 200 && (await red('GET', '/v1/types-actes')).body.find((t) => t.code === 'AM').nbEtapes >= 4);

  verifier('type désactivé', (await admin('PATCH', `/v1/admin/types/${am.id}`, { actif: false })).status === 204);
  verifier('type désactivé : absent de « Nouvel acte »', !(await red('GET', '/v1/types-actes')).body.some((t) => t.code === 'AM'));
  verifier('type désactivé : nouvel acte refusé', (await creerAm()).body?.code === 'TYPE_INACTIF');
  a = (await red('GET', `/v1/actes/${brouillon}`)).body;
  verifier('type désactivé : brouillon non soumissible', (await red('POST', `/v1/actes/${brouillon}/soumission`, { version: a.version })).body?.code === 'TYPE_INACTIF');
  verifier('type désactivé : l’acte en cours reste consultable', (await red('GET', `/v1/actes/${enCours}/suivi`)).status === 200);
  verifier('type réactivé', (await admin('PATCH', `/v1/admin/types/${am.id}`, { actif: true })).status === 204 && (await red('GET', '/v1/types-actes')).body.some((t) => t.code === 'AM'));
  await red('DELETE', `/v1/actes/${brouillon}`);

  // BF-06
  r = await admin('POST', '/v1/admin/structures', { code: `T${suffixe}`, libelle: 'Structure de test', parentId: dag.id });
  verifier('BF-06 structure créée sous la DAG', r.status === 201);
  verifier('sigle en double → 409', (await admin('POST', '/v1/admin/structures', { code: 'DAG', libelle: 'Doublon' })).status === 409);

  // BF-07 / BF-08
  await fetch(`${MAILPIT}/messages`, { method: 'DELETE' });
  const email = `agent.${suffixe.toLowerCase()}@minesup.test`;
  r = await admin('POST', '/v1/admin/utilisateurs', { matricule: `MINESUP-T${suffixe}`, email, prenom: 'Paul', nom: 'Test', structureId: dag.id, roles: ['REDACTEUR'] });
  const idU = r.body?.id;
  verifier('BF-07 compte créé', r.status === 201);
  await new Promise((x) => setTimeout(x, 1500));
  const mails = (await (await fetch(`${MAILPIT}/messages`)).json()).messages ?? [];
  verifier('e-mail d’activation (lien de 30 min) dans Mailpit', mails.some((m) => m.To[0].Address === email && m.Subject.includes('mot de passe')));
  verifier('BF-08 rôles modifiés', (await admin('PATCH', `/v1/admin/utilisateurs/${idU}`, { roles: ['REDACTEUR', 'VISEUR'] })).status === 204);
  verifier('BF-07 compte désactivé (jamais supprimé)', (await admin('PATCH', `/v1/admin/utilisateurs/${idU}`, { actif: false })).status === 204);
  const moi = (await admin('GET', '/v1/auth/moi')).body;
  verifier('un administrateur ne se désactive pas', (await admin('PATCH', `/v1/admin/utilisateurs/${moi.id}`, { actif: false })).status === 403);
  verifier('déverrouillage', (await admin('POST', `/v1/admin/utilisateurs/${idU}/deverrouillage`)).status === 204);
  const liste = (await admin('GET', '/v1/admin/utilisateurs')).body;
  verifier('J2 liste des comptes', liste.some((x) => x.id === idU && !x.actif && x.roles.includes('VISEUR')));

  const aud = await session('MINESUP-07341');
  const actions = new Set((await aud('GET', '/v1/audit?limite=60')).body.map((e) => e.action));
  verifier('paramétrage et droits journalisés', actions.has('parametrage.circuit_cree') || actions.has('parametrage.etape_ajoutee'));
  verifier('désactivation et réactivation du circuit journalisées', actions.has('parametrage.circuit_desactive') && actions.has('parametrage.circuit_reactive'));
  verifier('modification de droits journalisée (BF-48)', actions.has('utilisateur.droits_modifies'));

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
