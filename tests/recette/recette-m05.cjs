// Recette M05 (parapheur, visas, corrections, rejet) + notifications e-mail dans Mailpit.
const { authenticator } = require(require.resolve('otplib', { paths: [require('node:path').join(__dirname, '..', '..', 'apps', 'api')] }));
const API = process.env.EACT_API ?? 'http://localhost:3000';
const MAILPIT = process.env.EACT_MAILPIT ?? 'http://localhost:8025/api/v1';
const MDP = 'Minesup@2026';
let ok = 0, ko = 0;
const verifier = (nom, cond, info = '') => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO '} ${nom}${info !== '' ? ' — ' + info : ''}`); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(matricule) {
  const jar = {};
  const appel = async (methode, chemin, corps) => {
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { ...(corps ? { 'content-type': 'application/json' } : {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); jar[k] = v.join('='); }
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  let r = await appel('POST', '/v1/auth/login', { identifiant: matricule, motDePasse: MDP });
  if (r.body?.etape === 'MFA') r = await appel('POST', '/v1/auth/mfa/verify', { code: authenticator.generate('JBSWY3DPEHPK3PXP') });
  if (r.body?.etape !== 'CONNECTE') throw new Error(`connexion ${matricule} : ${JSON.stringify(r.body)}`);
  return appel;
}
const courriels = async () => (await (await fetch(`${MAILPIT}/messages?limit=50`)).json()).messages ?? [];
const recus = async (adresse, sujet) => (await courriels()).filter((m) => m.To.some((t) => t.Address === adresse) && m.Subject.includes(sujet));

async function nouvelleNote(red, objet) {
  const ns = (await red('GET', '/v1/types-actes')).body.find((t) => t.code === 'NS');
  const modele = (await red('GET', `/v1/modeles?typeActeId=${ns.id}`)).body.modeles[0];
  const { id } = (await red('POST', '/v1/actes', { typeActeId: ns.id, modeleId: modele.id })).body;
  let a = (await red('GET', `/v1/actes/${id}`)).body;
  const v = (await red('PATCH', `/v1/actes/${id}`, { version: a.version, objet })).body.version;
  const r = await red('POST', `/v1/actes/${id}/soumission`, { version: v });
  if (r.status !== 200) throw new Error('soumission ' + JSON.stringify(r.body));
  return id;
}
const version = async (s, id) => (await s('GET', `/v1/actes/${id}`)).body.version;

(async () => {
  await fetch(`${MAILPIT}/messages`, { method: 'DELETE' });
  const christelle = await session('MINESUP-04812'); // rédactrice, SP
  const marie = await session('MINESUP-02845'); // chef du Service du Personnel
  const abdou = await session('MINESUP-03107'); // directeur DAG
  const ibrahim = await session('MINESUP-00017'); // SG (TOTP)

  const id = await nouvelleNote(christelle, 'portant organisation de la permanence au Service du Courrier');
  await pause(1500);
  verifier('soumission → e-mail « attend votre visa » à la cheffe de service', (await recus('m.belinga@minesup.test', 'attend votre visa')).length === 1);

  let p = (await marie('GET', '/v1/parapheur')).body;
  const ligne = p.aViser.find((a) => a.id === id);
  verifier('BF-23 l’acte est dans le parapheur de Marie (étape 1)', ligne?.etape.ordre === 1 && !!ligne.echeance, ligne?.etape.libelle);
  verifier('RG-04 absent du parapheur du directeur à l’étape 1', !(await abdou('GET', '/v1/parapheur')).body.aViser.some((a) => a.id === id));
  verifier('RBAC : la rédactrice n’a pas de parapheur', (await christelle('GET', '/v1/parapheur')).status === 403);

  let s = (await marie('GET', `/v1/actes/${id}/suivi`)).body;
  verifier('BF-28 viseurs prévus par étape', s.etapes.map((e) => e.viseurs.join()).join(' → ') === 'Marie BELINGA → Abdou NJOYA → Ibrahim BELLO', s.etapes.map((e) => e.viseurs.join()).join(' → '));
  verifier('suivi : Marie peut viser', s.peutViser === true);
  verifier('D8 : le directeur ne peut pas encore viser', (await abdou('GET', `/v1/actes/${id}/suivi`)).body.raisonNonVisa === 'PAS_VOTRE_ETAPE');

  // Visa favorable, verrou optimiste
  let r = await marie('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: ligne.version - 1 });
  verifier('§14.2 version périmée → 409', r.status === 409 && r.body.code === 'CONFLIT_VERSION');
  r = await marie('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: ligne.version, observation: 'Vu et transmis.' });
  verifier('BF-24 visa favorable → étape 2', r.status === 200 && r.body.etape?.ordre === 2, r.body.etape?.libelle);
  r = await marie('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: r.body.version });
  verifier('RG-04/RG-18 Marie ne revise pas l’étape suivante', r.status === 403);
  await pause(1500);
  verifier('e-mail au directeur', (await recus('a.njoya@minesup.test', 'attend votre visa')).length === 1);

  // Correction vers une étape antérieure
  r = await abdou('POST', `/v1/actes/${id}/visas`, { decision: 'CORRECTION', version: await version(abdou, id), etapeRetour: 1 });
  verifier('RG-06 motif obligatoire', r.status === 422 && r.body.code === 'MOTIF_OBLIGATOIRE');
  r = await abdou('POST', `/v1/actes/${id}/visas`, { decision: 'CORRECTION', version: await version(abdou, id), etapeRetour: 2, observation: 'x' });
  verifier('étape de retour non franchie refusée', r.status === 422);
  r = await abdou('POST', `/v1/actes/${id}/visas`, { decision: 'CORRECTION', version: await version(abdou, id), etapeRetour: 1, observation: 'Préciser les horaires du samedi.' });
  verifier('D4 renvoi au visa du chef de service', r.body.statut === 'EN_CIRCUIT' && r.body.etape?.ordre === 1);
  r = await marie('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: await version(marie, id), observation: 'Horaires précisés, RAS.' });
  verifier('RG-18 nouveau tour : Marie vise à nouveau', r.status === 200 && r.body.etape?.ordre === 2);

  // Correction vers la rédaction (C9)
  r = await abdou('POST', `/v1/actes/${id}/visas`, { decision: 'CORRECTION', version: await version(abdou, id), etapeRetour: 0, observation: 'Ajouter la date d’effet à l’article 2.' });
  verifier('BF-25 renvoi à la rédaction → À corriger', r.body.statut === 'A_CORRIGER');
  await pause(1500);
  verifier('e-mail « Correction demandée » à la rédactrice', (await recus('c.ebogo@minesup.test', 'Correction demandée')).length === 1);
  s = (await christelle('GET', `/v1/actes/${id}/suivi`)).body;
  verifier('C9 dernier renvoi visible par la rédactrice', s.dernierRenvoi?.viseur === 'Abdou NJOYA' && s.dernierRenvoi.observation.includes('date d’effet'));
  let a = (await christelle('GET', `/v1/actes/${id}`)).body;
  verifier('le projet redevient modifiable', a.modifiable === true);
  const v2 = (await christelle('PATCH', `/v1/actes/${id}`, { version: a.version, contenu: a.contenu + '<p><strong>Article 3.</strong> Effet au 7 novembre 2026.</p>' })).body.version;
  r = await christelle('POST', `/v1/actes/${id}/soumission`, { version: v2 });
  verifier('resoumission → reprend au visa du chef de service', r.body.etape?.ordre === 1);

  // Circuit complet jusqu'à « prêt à signer »
  await marie('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: await version(marie, id) });
  await abdou('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: await version(abdou, id) });
  verifier('l’acte arrive au SG (étape 3)', (await ibrahim('GET', '/v1/parapheur')).body.aViser.some((x) => x.id === id && x.etape.ordre === 3));
  r = await ibrahim('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: await version(ibrahim, id) });
  verifier('dernier visa → Prêt à signer', r.body.statut === 'PRET_A_SIGNER');
  await pause(1500);
  verifier('e-mail « prêt à signer » au signataire délégué (SG)', (await recus('i.bello@minesup.test', 'prêt à signer')).length === 1);
  s = (await christelle('GET', `/v1/actes/${id}/suivi`)).body;
  verifier('historique : 2 soumissions + 7 décisions', s.historique.filter((h) => h.type === 'SOUMISSION').length === 2 && s.historique.filter((h) => h.type === 'VISA').length === 7);
  verifier('C1 : version 2 du texte figée', s.numeroVersion === 2);

  // Rejet (D5)
  const id2 = await nouvelleNote(christelle, 'portant doublon à rejeter');
  r = await marie('POST', `/v1/actes/${id2}/visas`, { decision: 'REJET', version: await version(marie, id2), observation: '  ' });
  verifier('RG-05 rejet sans motif refusé', r.status === 422);
  r = await marie('POST', `/v1/actes/${id2}/visas`, { decision: 'REJET', version: await version(marie, id2), observation: 'Doublon d’une note existante.' });
  verifier('BF-26 rejet définitif', r.body.statut === 'REJETE');
  await pause(1500);
  verifier('e-mail « Projet rejeté » à la rédactrice', (await recus('c.ebogo@minesup.test', 'Projet rejeté')).length === 1);
  verifier('plus aucun visa possible sur un acte rejeté', (await abdou('POST', `/v1/actes/${id2}/visas`, { decision: 'FAVORABLE', version: await version(christelle, id2) })).status !== 200);

  // Audit
  const aud = await session('MINESUP-07341');
  const actions = new Set((await aud('GET', '/v1/audit?limite=80')).body.map((e) => e.action));
  verifier('journal : visas, corrections, rejet', ['acte.vise', 'acte.a_corriger', 'acte.rejete'].every((x) => actions.has(x)));
  verifier('aucun e-mail ne contient le texte de l’acte', !(await Promise.all((await courriels()).map(async (m) => (await (await fetch(`${MAILPIT}/message/${m.ID}`)).json()).Text))).some((t) => t.includes('Article 1er')));

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
