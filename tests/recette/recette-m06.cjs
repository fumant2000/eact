// Recette M06 (signature, numérotation, PDF/A) + M13 (vérification publique) + TF-07 / TF-08.
const { randomUUID } = require('node:crypto');
const { execSync } = require('node:child_process');
const { authenticator } = require(require.resolve('otplib', { paths: [require('node:path').join(__dirname, '..', '..', 'apps', 'api')] }));
const API = process.env.EACT_API ?? 'http://localhost:3000';
const MAILPIT = process.env.EACT_MAILPIT ?? 'http://localhost:8025/api/v1';
const MDP = 'Minesup@2026';
const SECRET = 'JBSWY3DPEHPK3PXP';
let ok = 0, ko = 0;
const verifier = (nom, cond, info = '') => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO '} ${nom}${info !== '' ? ' — ' + info : ''}`); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`docker compose exec -T postgres psql -U eact -d eact -tAc "${q}"`, { cwd: require('node:path').join(__dirname, '..', '..') }).toString().trim();

async function session(matricule) {
  const jar = {};
  const appel = async (methode, chemin, corps, entetes = {}, brut = false) => {
    const estForm = corps instanceof FormData;
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { ...(corps && !estForm ? { 'content-type': 'application/json' } : {}), ...entetes, cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
      body: estForm ? corps : corps ? JSON.stringify(corps) : undefined,
    });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); jar[k] = v.join('='); }
    return { status: r.status, body: brut ? Buffer.from(await r.arrayBuffer()) : await r.json().catch(() => null) };
  };
  let r = await appel('POST', '/v1/auth/login', { identifiant: matricule, motDePasse: MDP });
  if (r.body?.etape === 'MFA') r = await appel('POST', '/v1/auth/mfa/verify', { code: authenticator.generate(SECRET) });
  if (r.body?.etape !== 'CONNECTE') throw new Error(`connexion ${matricule} : ${JSON.stringify(r.body)}`);
  return appel;
}
const version = async (s, id) => (await s('GET', `/v1/actes/${id}`)).body.version;

(async () => {
  await fetch(`${MAILPIT}/messages`, { method: 'DELETE' });
  const christelle = await session('MINESUP-04812');
  const marie = await session('MINESUP-02845');
  const abdou = await session('MINESUP-03107');
  const ibrahim = await session('MINESUP-00017');
  const roger = await session('MINESUP-00001');

  // Préparer une note de service jusqu'à « prêt à signer »
  const ns = (await christelle('GET', '/v1/types-actes')).body.find((t) => t.code === 'NS');
  const modele = (await christelle('GET', `/v1/modeles?typeActeId=${ns.id}`)).body.modeles.find((m) => m.version === '2.3');
  const { id } = (await christelle('POST', '/v1/actes', { typeActeId: ns.id, modeleId: modele.id })).body;
  let v = (await christelle('PATCH', `/v1/actes/${id}`, { version: await version(christelle, id), objet: 'portant organisation de la permanence pendant les fêtes de fin d’année' })).body.version;
  await christelle('POST', `/v1/actes/${id}/soumission`, { version: v });
  for (const s of [marie, abdou, ibrahim]) await s('POST', `/v1/actes/${id}/visas`, { decision: 'FAVORABLE', version: await version(s, id) });
  verifier('acte prêt à signer', (await christelle('GET', `/v1/actes/${id}`)).body.statut === 'PRET_A_SIGNER');

  // E1 / RG-11
  verifier('E1 le SG (délégation NS) voit l’acte à signer', (await ibrahim('GET', '/v1/signature')).body.some((a) => a.id === id));
  verifier('E1 le Ministre (titulaire) le voit aussi', (await roger('GET', '/v1/signature')).body.some((a) => a.id === id));
  verifier('la rédactrice n’a rien à signer', (await christelle('GET', '/v1/signature')).body.length === 0);
  let e = (await ibrahim('GET', `/v1/actes/${id}/signature`)).body;
  verifier('E2 qualité du signataire délégué', e.peutSigner && e.qualite.startsWith('Pour le Ministre'), e.qualite);
  verifier('RG-19 la rédactrice ne peut pas signer', (await christelle('GET', `/v1/actes/${id}/signature`)).body.peutSigner === false);

  // RG-12, §16.3
  let r = await ibrahim('POST', `/v1/actes/${id}/signature`, { code: authenticator.generate(SECRET) });
  verifier('sans Idempotency-Key → 400', r.status === 400);
  r = await ibrahim('POST', `/v1/actes/${id}/signature`, { code: '000000' }, { 'Idempotency-Key': randomUUID() });
  verifier('E3 code faux → refus, 4 essais restants, acte non signé', r.status === 401 && r.body.essaisRestants === 4);
  r = await christelle('POST', `/v1/actes/${id}/signature`, { code: '000000' }, { 'Idempotency-Key': randomUUID() });
  verifier('RG-19 signature par la rédactrice refusée', r.status === 403);

  const cle = randomUUID();
  const t0 = Date.now();
  r = await ibrahim('POST', `/v1/actes/${id}/signature`, { code: authenticator.generate(SECRET) }, { 'Idempotency-Key': cle });
  const signe = r.body;
  verifier('UC-09 signature → 201 + référence', r.status === 201 && /^N° \d{2}\/\d{4}\/NS\/MINESUP\/SG\/DAG$/.test(signe.reference ?? ''), `${signe.reference} en ${Date.now() - t0} ms`);
  verifier('QR et code court renvoyés immédiatement', signe.qrCode?.startsWith('data:image/png') && /^[A-Z2-9]{4}-[A-Z2-9]{2}$/.test(signe.codeVerification), signe.codeVerification);
  let pret = false; const t2 = Date.now();
  while (!pret && Date.now() - t2 < 60_000) { await pause(500); pret = (await ibrahim('GET', `/v1/actes/${id}/signature`)).body?.resultat?.pdfDisponible; }
  verifier('BF-32 PDF/A produit en arrière-plan', pret, `${Date.now() - t2} ms après la signature`);
  verifier('BF-31 horodatage serveur', Math.abs(new Date(signe.signeLe).getTime() - Date.now()) < 60_000);
  r = await ibrahim('POST', `/v1/actes/${id}/signature`, { code: '000000' }, { 'Idempotency-Key': cle });
  verifier('TF-08 requête rejouée → même référence, pas de second numéro', r.status === 201 && r.body.rejoue === true && r.body.reference === signe.reference);
  r = await roger('POST', `/v1/actes/${id}/signature`, { code: authenticator.generate(SECRET) }, { 'Idempotency-Key': randomUUID() });
  verifier('nouvelle tentative sur un acte signé → 409', r.status === 409);
  r = await christelle('PATCH', `/v1/actes/${id}`, { version: await version(christelle, id), objet: 'falsifié' });
  verifier('RG-10 acte signé immuable', r.status === 409 && r.body.code === 'ACTE_IMMUABLE');

  // PDF
  r = await christelle('GET', `/v1/actes/${id}/pdf`, undefined, {}, true);
  const pdf = r.body;
  verifier('PDF téléchargeable par la rédactrice', r.status === 200 && pdf.subarray(0, 5).toString() === '%PDF-');
  verifier('PDF/A-2b déclaré dans les métadonnées XMP', /pdfaid:part["'>=\s]*2/.test(pdf.toString('latin1')) && /pdfaid:conformance["'>=\s]*B/i.test(pdf.toString('latin1')));

  // M13 public
  const pub = await fetch(`${API}/public/verifier/${signe.codeVerification.toLowerCase().replace('-', ' ')}`);
  const verif = await pub.json();
  verifier('UC-17 vérification publique sans session (code saisi approximativement)', pub.status === 200 && verif.statut === 'VALIDE' && verif.reference === signe.reference, verif.qualite);
  verifier('RG-21 objet masqué (acte Interne)', verif.objet === null && verif.empreinteTexte === signe.empreinteSha256);
  verifier('code inconnu → 404', (await fetch(`${API}/public/verifier/ZZZZ-ZZ`)).status === 404);
  const comparer = async (octets) => {
    const f = new FormData(); f.append('fichier', new Blob([octets]), 'acte.pdf');
    return (await (await fetch(`${API}/public/verifier/${signe.codeVerification}/fichier`, { method: 'POST', body: f })).json()).identique;
  };
  verifier('BF-57 PDF original → identique', (await comparer(pdf)) === true);
  const modifie = Buffer.from(pdf); modifie[modifie.length - 20] ^= 1;
  verifier('TF-10 PDF modifié d’un seul octet → non conforme', (await comparer(modifie)) === false);

  await pause(1500);
  const mails = (await (await fetch(`${MAILPIT}/messages?limit=50`)).json()).messages;
  verifier('e-mail « Acte signé » à la rédactrice', mails.some((m) => m.Subject.includes('Acte signé') && m.To[0].Address === 'c.ebogo@minesup.test'));

  // TF-07 : signatures simultanées
  const N = 20;
  const red = sql("SELECT id FROM utilisateur WHERE matricule='MINESUP-04812'");
  const dag = sql("SELECT id FROM structure WHERE code='DAG'");
  const ids = sql(`INSERT INTO acte (id, type_acte_id, structure_id, redacteur_id, objet, contenu, statut, mis_a_jour_le) SELECT gen_random_uuid(), '${ns.id}', '${dag}', '${red}', 'TF-07 n° ' || g, '<p>Test de concurrence.</p>', 'PRET_A_SIGNER', now() FROM generate_series(1, ${N}) g RETURNING id`).split(/\s+/).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const avant = Number(sql(`SELECT coalesce(max(dernier_numero),0) FROM compteur_numerotation WHERE type_acte_id='${ns.id}' AND structure_id='${dag}'`));
  const code = authenticator.generate(SECRET);
  const t1 = Date.now();
  const resultats = await Promise.all(ids.map((x) => ibrahim('POST', `/v1/actes/${x}/signature`, { code }, { 'Idempotency-Key': randomUUID() })));
  resultats.filter((x) => x.status !== 201).slice(0, 3).forEach((x) => console.log('   échec :', x.status, JSON.stringify(x.body)));
  const sequences = resultats.map((x) => Number(x.body?.reference?.split('/')[1])).sort((a, b) => a - b);
  const attendues = Array.from({ length: N }, (_, i) => avant + 1 + i);
  verifier(`TF-07 ${N} signatures simultanées → ${N} numéros consécutifs, aucun doublon ni trou`, resultats.every((x) => x.status === 201) && JSON.stringify(sequences) === JSON.stringify(attendues), `${sequences[0]}…${sequences.at(-1)} en ${Date.now() - t1} ms`);

  // Les actes de test non signés ne doivent pas encombrer « À signer » pendant une démo.
  sql("DELETE FROM acte WHERE objet LIKE 'TF-07 n° %' AND statut = 'PRET_A_SIGNER'");

  // Audit
  const aud = await session('MINESUP-07341');
  const actions = new Set((await aud('GET', '/v1/audit?limite=100')).body.map((x) => x.action));
  verifier('journal : acte.signe et acte.verifie', actions.has('acte.signe') && actions.has('acte.verifie'));

  console.log(`\n${ok} OK, ${ko} KO · code de vérification à essayer : ${signe.codeVerification}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
