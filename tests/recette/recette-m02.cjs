// Recette M02 délégations (BF-09, BF-10, RG-04, RG-11).
const { execSync } = require('node:child_process');
const { authenticator } = require(require.resolve('otplib', { paths: [require('node:path').join(__dirname, '..', '..', 'apps', 'api')] }));
const API = process.env.EACT_API ?? 'http://localhost:3000';
let ok = 0, ko = 0;
const verifier = (nom, cond, info = '') => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO '} ${nom}${info !== '' ? ' — ' + info : ''}`); };
const sql = (q) => execSync(`docker compose exec -T postgres psql -U eact -d eact -tAc "${q}"`, { cwd: require('node:path').join(__dirname, '..', '..') }).toString().trim();
const jour = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Africa/Douala' });

async function session(matricule) {
  const jar = {};
  const appel = async (methode, chemin, corps) => {
    const r = await fetch(API + chemin, { method: methode, headers: { ...(corps ? { 'content-type': 'application/json' } : {}), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: corps ? JSON.stringify(corps) : undefined });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); jar[k] = v.join('='); }
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  let r = await appel('POST', '/v1/auth/login', { identifiant: matricule, motDePasse: 'Minesup@2026' });
  if (r.body?.etape === 'MFA') r = await appel('POST', '/v1/auth/mfa/verify', { code: authenticator.generate('JBSWY3DPEHPK3PXP') });
  if (r.body?.etape !== 'CONNECTE') throw new Error(matricule + ' ' + JSON.stringify(r.body));
  return appel;
}

(async () => {
  const roger = await session('MINESUP-00001');
  const abdou = await session('MINESUP-03107');
  const marie = await session('MINESUP-02845');
  const christelle = await session('MINESUP-04812');
  const ids = Object.fromEntries((await roger('GET', '/v1/delegations/candidats')).body.personnes.map((p) => [p.nom, p.id]));
  const c = (await roger('GET', '/v1/delegations/candidats')).body;
  verifier('F2 le Ministre peut déléguer sa signature ; projets de décret exclus', c.peutDeleguerSignature && !c.types.some((x) => x.code === 'DEC'));

  const base = { delegataireId: ids['Abdou NJOYA'], type: 'SIGNATURE', du: jour(0), au: jour(10), mention: 'Pour le Ministre et par délégation, Abdou NJOYA', perimetre: ['C'] };
  let r = await roger('POST', '/v1/delegations', base);
  verifier('délégation de signature sans code → refusée', r.status === 401 && r.body.code === 'CODE_INVALIDE');
  r = await roger('POST', '/v1/delegations', { ...base, au: jour(-1), code: authenticator.generate('JBSWY3DPEHPK3PXP') });
  verifier('fin avant début → 422', r.status === 422);
  r = await roger('POST', '/v1/delegations', { ...base, delegataireId: (await roger('GET', '/v1/auth/moi')).body.id, code: '000000' });
  verifier('se déléguer à soi-même → refusé', r.status === 422 || r.status === 404);
  r = await christelle('POST', '/v1/delegations', { ...base, type: 'INTERIM', perimetre: [] });
  verifier('une rédactrice n’a rien à confier par intérim → 403', r.status === 403);
  r = await roger('POST', '/v1/delegations', { ...base, code: authenticator.generate('JBSWY3DPEHPK3PXP') });
  const idDeleg = r.body?.id;
  verifier('BF-09 délégation de signature enregistrée', r.status === 201 && !!idDeleg);
  verifier('F1 vue par le délégataire (reçue, active)', (await abdou('GET', '/v1/delegations')).body.some((d) => d.id === idDeleg && d.sens === 'RECUE' && d.etat === 'ACTIVE'));

  // Compétence : un communiqué prêt à signer devient signable par Abdou
  const ns = sql("SELECT id FROM type_acte WHERE code='C'");
  const dag = sql("SELECT id FROM structure WHERE code='DAG'");
  const red = sql("SELECT id FROM utilisateur WHERE matricule='MINESUP-04812'");
  const acte = sql(`INSERT INTO acte (id, type_acte_id, structure_id, redacteur_id, objet, contenu, statut, mis_a_jour_le) VALUES (gen_random_uuid(), '${ns}', '${dag}', '${red}', 'Test délégation C', '<p>x</p>', 'PRET_A_SIGNER', now() at time zone 'UTC') RETURNING id`).split(/\s+/)[0];
  verifier('RG-11 le délégataire voit le communiqué à signer', (await abdou('GET', '/v1/signature')).body.some((a) => a.id === acte));
  verifier('qualité = mention de la délégation', (await abdou('GET', `/v1/actes/${acte}/signature`)).body.qualite === base.mention);
  r = await abdou('POST', `/v1/delegations/${idDeleg}/revocation`);
  verifier('le délégataire ne peut pas révoquer', r.status === 403);
  r = await roger('POST', `/v1/delegations/${idDeleg}/revocation`);
  verifier('révocation par le Ministre', r.status === 204);
  verifier('après révocation, plus rien à signer', !(await abdou('GET', '/v1/signature')).body.some((a) => a.id === acte));
  sql(`DELETE FROM acte WHERE id='${acte}'`);

  // Intérim d'une viseuse (RG-04)
  r = await marie('POST', '/v1/delegations', { delegataireId: ids['Abdou NJOYA'], type: 'INTERIM', du: jour(0), au: jour(3), mention: 'Pour le chef de service, l’intérimaire', perimetre: [] });
  const idInterim = r.body?.id;
  verifier('intérim déclaré par la cheffe de service (sans code : pas de 2FA)', r.status === 201);
  const types = (await christelle('GET', '/v1/types-actes')).body;
  const nsType = types.find((t) => t.code === 'NS');
  const { id } = (await christelle('POST', '/v1/actes', { typeActeId: nsType.id })).body;
  let a = (await christelle('GET', `/v1/actes/${id}`)).body;
  const v = (await christelle('PATCH', `/v1/actes/${id}`, { version: a.version, objet: 'portant test d’intérim', contenu: '<p>Texte.</p>', ampliations: ['SG'] })).body.version;
  await christelle('POST', `/v1/actes/${id}/soumission`, { version: v });
  const ligne = (await abdou('GET', '/v1/parapheur')).body.aViser.find((x) => x.id === id);
  verifier('RG-04 l’intérimaire reçoit l’acte de l’étape 1', ligne?.etape.ordre === 1 && ligne.interimDe?.nom === 'Marie BELINGA', ligne?.interimDe?.mention);
  await marie('POST', `/v1/delegations/${idInterim}/revocation`);
  verifier('après révocation de l’intérim, l’acte quitte son parapheur', !(await abdou('GET', '/v1/parapheur')).body.aViser.some((x) => x.id === id));

  // BF-10 : expiration matérialisée
  sql(`UPDATE delegation SET fin = (now() at time zone 'UTC') - interval '1 minute', actif = true WHERE id='${idInterim}'`);
  verifier('BF-10 délégation échue présentée « expirée »', (await marie('GET', '/v1/delegations')).body.find((d) => d.id === idInterim)?.etat === 'EXPIREE');

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
