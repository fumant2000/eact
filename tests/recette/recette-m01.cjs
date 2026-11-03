// Recette M01 de bout en bout contre l'API locale (http://localhost:3000) et Mailpit (EACT_MAILPIT, défaut http://localhost:8025).
const { authenticator } = require(require.resolve('otplib', { paths: [require('node:path').join(__dirname, '..', '..', 'apps', 'api')] }));
const API = process.env.EACT_API ?? 'http://localhost:3000';
const MAILPIT = process.env.EACT_MAILPIT ?? 'http://localhost:8025/api/v1';
const MDP = 'Minesup@2026';
const SECRET = 'JBSWY3DPEHPK3PXP';
let ok = 0, ko = 0;
const verifier = (nom, cond, info = '') => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO '} ${nom}${info ? ' — ' + info : ''}`); };

function client() {
  const jar = {};
  return async (methode, chemin, corps) => {
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const [kv] = c.split(';'); const [k, ...v] = kv.split('=');
      if (v.join('=') === '') delete jar[k]; else jar[k] = v.join('=');
    }
    return { status: r.status, body: await r.json().catch(() => null), jar };
  };
}

(async () => {
  let c = client();
  verifier('route protégée sans session → 401', (await c('GET', '/v1/auth/moi')).status === 401);

  // BF-01 rédactrice, sans MFA
  let r = await c('POST', '/v1/auth/login', { identifiant: 'minesup-04812', motDePasse: MDP });
  verifier('BF-01 connexion par matricule (insensible à la casse)', r.body?.etape === 'CONNECTE');
  verifier('jetons en cookies httpOnly, absents du corps', !!r.jar.eact_at && !JSON.stringify(r.body).includes('eyJ'));
  r = await c('GET', '/v1/auth/moi');
  verifier('profil /moi', r.body?.matricule === 'MINESUP-04812', r.body?.structure?.code);
  verifier('RBAC : rédactrice refusée sur /v1/audit', (await c('GET', '/v1/audit')).status === 403);
  r = await client()('POST', '/v1/auth/login', { identifiant: 'c.ebogo@minesup.test', motDePasse: MDP });
  verifier('BF-01 connexion par e-mail', r.body?.etape === 'CONNECTE');

  // BF-03 verrouillage
  const t = client(); let restants = [];
  for (let i = 0; i < 5; i++) { r = await t('POST', '/v1/auth/login', { identifiant: 'MINESUP-06233', motDePasse: 'mauvais' }); restants.push(r.body?.essaisRestants ?? r.body?.code); }
  verifier('BF-03 essais restants puis verrouillage', r.status === 403 && r.body?.code === 'COMPTE_VERROUILLE', restants.join(','));
  r = await t('POST', '/v1/auth/login', { identifiant: 'MINESUP-06233', motDePasse: MDP });
  verifier('BF-03 bon mot de passe refusé pendant le verrou', r.status === 403 && !!r.body?.deverrouillageLe);
  const p = client();
  await Promise.all(Array.from({ length: 8 }, () => p('POST', '/v1/auth/login', { identifiant: 'MINESUP-05520', motDePasse: 'mauvais' })));
  r = await p('POST', '/v1/auth/login', { identifiant: 'MINESUP-05520', motDePasse: MDP });
  verifier('BF-03 8 essais simultanés → verrouillage (aucun échec perdu)', r.status === 403 && r.body?.code === 'COMPTE_VERROUILLE');
  r = await t('POST', '/v1/auth/login', { identifiant: 'INCONNU-1', motDePasse: 'x' });
  verifier('compte inconnu → même réponse générique', r.status === 401 && r.body?.code === 'IDENTIFIANTS_INCORRECTS' && r.body?.essaisRestants === undefined);

  // BF-02 SG avec TOTP
  c = client();
  r = await c('POST', '/v1/auth/login', { identifiant: 'MINESUP-00017', motDePasse: MDP });
  verifier('BF-02 SG → étape MFA, sans session', r.body?.etape === 'MFA' && !r.jar.eact_at && !!r.jar.eact_mfa);
  r = await c('POST', '/v1/auth/mfa/verify', { code: '000000' });
  verifier('BF-02 code faux → 401 + essais restants', r.status === 401 && r.body?.essaisRestants === 2);
  const c2 = client();
  await c2('POST', '/v1/auth/login', { identifiant: 'MINESUP-00017', motDePasse: MDP });
  r = await c2('POST', '/v1/auth/mfa/verify', { code: '000000' });
  verifier('BF-02 se reconnecter ne redonne pas d’essais TOTP', r.status === 401 && r.body?.essaisRestants === 1);
  r = await c('POST', '/v1/auth/mfa/verify', { code: authenticator.generate(SECRET) });
  verifier('BF-02 code TOTP valide → connecté', r.body?.etape === 'CONNECTE');
  r = await c('GET', '/v1/auth/moi');
  verifier('BF-09 délégation active visible', r.body?.delegationsActives?.[0]?.perimetre?.join() === 'NS,D,ATT', r.body?.delegationsActives?.[0]?.mention);

  // BF-04 rafraîchissement et révocation
  const avant = r.jar.eact_rt;
  r = await c('POST', '/v1/auth/refresh');
  verifier('BF-04 rafraîchissement avec rotation du jeton', r.status === 200 && r.jar.eact_rt !== avant);
  const volé = { ...r.jar };
  r = await c('POST', '/v1/auth/logout');
  verifier('BF-04 déconnexion', r.status === 200 && !r.jar.eact_rt);
  const pirate = client();
  r = await fetch(API + '/v1/auth/refresh', { method: 'POST', headers: { cookie: `eact_rt=${volé.eact_rt}` } });
  verifier('BF-04 jeton révoqué inutilisable après déconnexion', r.status === 401);

  // BF-02 enrôlement de l'administrateur (B3)
  c = client();
  r = await c('POST', '/v1/auth/login', { identifiant: 'MINESUP-02019', motDePasse: MDP });
  if (r.body?.etape === 'ENROLEMENT') {
    r = await c('POST', '/v1/auth/mfa/enrolement');
    verifier('B3 enrôlement : QR + clé manuelle', r.body?.qrCode?.startsWith('data:image/png') && /^[A-Z2-7 ]+$/.test(r.body?.cleManuelle ?? ''));
    const secret = r.body.cleManuelle.replace(/ /g, '');
    r = await c('POST', '/v1/auth/mfa/enrolement/confirmation', { code: authenticator.generate(secret) });
    verifier('B3 confirmation → 8 codes de secours', r.body?.etape === 'CONNECTE' && r.body?.codesSecours?.length === 8, r.body?.codesSecours?.[0]);
    const secours = r.body.codesSecours[0];
    c = client();
    await c('POST', '/v1/auth/login', { identifiant: 'MINESUP-02019', motDePasse: MDP });
    r = await c('POST', '/v1/auth/mfa/verify', { code: secours.toLowerCase() });
    verifier('code de secours accepté', r.body?.etape === 'CONNECTE');
    c = client();
    await c('POST', '/v1/auth/login', { identifiant: 'MINESUP-02019', motDePasse: MDP });
    r = await c('POST', '/v1/auth/mfa/verify', { code: secours });
    verifier('code de secours à usage unique', r.status === 401);
  } else console.log('-- enrôlement déjà fait (relancer db:reset pour le rejouer) :', r.body?.etape);

  // BF-05 réinitialisation via Mailpit
  await fetch(`${MAILPIT}/messages`, { method: 'DELETE' });
  r = await client()('POST', '/v1/auth/mot-de-passe/oubli', { identifiant: 'a.njoya@minesup.test' });
  verifier('BF-05 demande → 202 + adresse masquée', r.status === 202, r.body?.destinataire);
  r = await client()('POST', '/v1/auth/mot-de-passe/oubli', { identifiant: 'personne@nulle.part' });
  verifier('BF-05 compte inconnu → même réponse', r.status === 202);
  const liste = await (await fetch(`${MAILPIT}/messages`)).json();
  verifier('Mailpit a capté exactement 1 e-mail', liste.total === 1, liste.messages?.[0]?.To?.[0]?.Address);
  const msg = await (await fetch(`${MAILPIT}/message/${liste.messages[0].ID}`)).json();
  const jeton = msg.Text.match(/jeton=([\w-]+)/)?.[1];
  r = await client()('POST', '/v1/auth/mot-de-passe/reinitialisation', { jeton, motDePasse: 'faible' });
  verifier('BF-05 politique de mot de passe appliquée', r.status === 400);
  r = await client()('POST', '/v1/auth/mot-de-passe/reinitialisation', { jeton, motDePasse: 'Nouveau#Mdp2026' });
  verifier('BF-05 nouveau mot de passe enregistré', r.status === 200);
  r = await client()('POST', '/v1/auth/mot-de-passe/reinitialisation', { jeton, motDePasse: 'Encore#Autre2026' });
  verifier('BF-05 lien à usage unique (410)', r.status === 410);
  r = await client()('POST', '/v1/auth/login', { identifiant: 'MINESUP-03107', motDePasse: 'Nouveau#Mdp2026' });
  verifier('connexion avec le nouveau mot de passe', r.body?.etape === 'CONNECTE');

  // M10 audit
  c = client();
  await c('POST', '/v1/auth/login', { identifiant: 'MINESUP-07341', motDePasse: MDP });
  r = await c('GET', '/v1/audit?limite=100');
  const actions = [...new Set((r.body ?? []).map((e) => e.action))];
  verifier('BF-48 événements d’authentification journalisés', actions.includes('utilisateur.compte_verrouille') && actions.includes('utilisateur.mfa_active'), actions.join(' '));
  verifier('paramètre « apres » invalide → 400', (await c('GET', '/v1/audit?apres=abc')).status === 400);
  r = await c('GET', '/v1/audit/verification');
  verifier('BF-50 chaîne du journal intègre', r.body?.integre === true);

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
