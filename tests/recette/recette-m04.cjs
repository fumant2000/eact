// Recette M04 (rédaction, pièces, soumission). API : variable EACT_API (défaut : démo complète).
const API = process.env.EACT_API ?? 'http://localhost:8080/api';
const MDP = 'Minesup@2026';
let ok = 0, ko = 0;
const verifier = (nom, cond, info = '') => { cond ? ok++ : ko++; console.log(`${cond ? 'OK ' : 'KO '} ${nom}${info !== '' ? ' — ' + info : ''}`); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(matricule) {
  const jar = {};
  const appel = async (methode, chemin, corps, brut = false) => {
    const estForm = corps instanceof FormData;
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { ...(estForm || !corps ? {} : { 'content-type': 'application/json' }), cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') },
      body: estForm ? corps : corps ? JSON.stringify(corps) : undefined,
    });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); jar[k] = v.join('='); }
    return { status: r.status, body: brut ? Buffer.from(await r.arrayBuffer()) : await r.json().catch(() => null) };
  };
  const r = await appel('POST', '/v1/auth/login', { identifiant: matricule, motDePasse: MDP });
  if (r.body?.etape !== 'CONNECTE') throw new Error(`connexion ${matricule} : ${JSON.stringify(r.body)}`);
  return appel;
}
const fichier = (nom, octets) => { const f = new FormData(); f.append('fichier', new Blob([octets]), nom); return f; };

(async () => {
  const red = await session('MINESUP-04812');

  // UC-06 étapes 1-2
  let r = await red('GET', '/v1/types-actes');
  const ns = r.body.find((t) => t.code === 'NS');
  verifier('types : NS rédigeable avec circuit de 3 étapes, signé par le SG par délégation', ns?.nbEtapes === 3 && ns.signataire === 'Le Secrétaire Général', ns?.signataire);
  verifier('types : AM sans circuit dans la structure → non rédigeable', r.body.find((t) => t.code === 'AM')?.nbEtapes === null);
  r = await red('GET', `/v1/modeles?typeActeId=${ns.id}`);
  const modele = r.body.modeles.find((m) => m.version === '2.3');
  verifier('modèles servis depuis le cache (RG-23)', r.body.source === 'cache' && r.body.modeles.length === 2);

  // BF-15 / BF-16
  r = await red('POST', '/v1/actes', { typeActeId: ns.id, modeleId: modele.id });
  const id = r.body.id;
  r = await red('GET', `/v1/actes/${id}`);
  let acte = r.body;
  verifier('BF-16 structure émettrice = DAG (rédactrice du SP)', acte.structure?.code === 'DAG' && acte.structure.chaine.join('/') === 'SG/DAG', acte.structure?.chaine?.join('/'));
  verifier('BF-16 corps et ampliation pré-remplis depuis le gabarit', acte.contenu.includes('Article 1er') && acte.ampliations.length === 3, acte.ampliations.join(', '));
  verifier('circuit prévu + signataire', acte.circuit?.etapes.length === 3 && acte.circuit.signature === 'Le Secrétaire Général');
  verifier('brouillon modifiable et supprimable', acte.modifiable && acte.supprimable && acte.statut === 'BROUILLON');

  // RG-03 / C6
  r = await red('PATCH', `/v1/actes/${id}`, { version: acte.version, ampliations: [] });
  r = await red('POST', `/v1/actes/${id}/soumission`, { version: r.body.version });
  verifier('RG-03 soumission refusée : objet et ampliation manquants', r.status === 422 && r.body.champs?.join() === 'objet,ampliation', r.body.champs?.join());

  // BF-17 enregistrement + verrou optimiste + nettoyage HTML
  acte = (await red('GET', `/v1/actes/${id}`)).body;
  r = await red('PATCH', `/v1/actes/${id}`, {
    version: acte.version,
    objet: 'portant calendrier des congés de fin d’année',
    contenu: '<p>Les services observeront une fermeture.</p><script>alert(1)</script><p onclick="x()"><strong>Article 1er.</strong> Permanence.</p>',
    ampliations: ['SG', 'Toutes directions', 'SG'],
    confidentialite: 'INTERNE',
  });
  const v2 = r.body.version;
  verifier('BF-17 enregistrement → nouvelle version', r.status === 200 && v2 === acte.version + 1);
  r = await red('PATCH', `/v1/actes/${id}`, { version: acte.version, objet: 'onglet périmé' });
  verifier('§14.2 verrou optimiste : version périmée → 409', r.status === 409 && r.body.code === 'CONFLIT_VERSION');
  acte = (await red('GET', `/v1/actes/${id}`)).body;
  verifier('HTML nettoyé (script et attributs retirés)', !acte.contenu.includes('script') && !acte.contenu.includes('onclick') && acte.contenu.includes('<strong>'));
  verifier('ampliations dédoublonnées', acte.ampliations.length === 2);
  r = await red('PATCH', `/v1/actes/${id}`, { version: acte.version, champInconnu: 1 });
  verifier('champ inconnu refusé (400)', r.status === 400);

  // BF-18 / RG-24 : pipeline tubes et filtres
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  const ids = {};
  for (const [nom, octets] of [['calendrier.pdf', pdf], ['virus.pdf', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(eicar)])], ['outil.exe', Buffer.from('MZ\x90\x00')], ['faux.pdf', Buffer.from('pas un pdf')]]) {
    r = await red('POST', `/v1/actes/${id}/pieces`, fichier(nom, octets));
    ids[nom] = r.body.id;
    if (nom === 'calendrier.pdf') verifier('dépôt → 202, analyse en attente', r.status === 202 && r.body.statutAnalyse === 'EN_ATTENTE');
  }
  r = await red('POST', `/v1/actes/${id}/soumission`, { version: (await red('GET', `/v1/actes/${id}`)).body.version });
  verifier('soumission bloquée pendant l’analyse', r.status === 409 && r.body.code === 'PIECES_EN_ANALYSE');
  r = await red('GET', `/v1/actes/${id}/pieces/${ids['calendrier.pdf']}`, undefined, true);
  verifier('RG-24 pièce inaccessible avant analyse', r.status === 403);
  await pause(2500);
  const pieces = Object.fromEntries((await red('GET', `/v1/actes/${id}`)).body.pieces.map((p) => [p.nomFichier, p]));
  verifier('PDF sain → SAINE, type déterminé par le contenu', pieces['calendrier.pdf'].statutAnalyse === 'SAINE' && pieces['calendrier.pdf'].typeMime === 'application/pdf');
  verifier('EICAR → INFECTEE (fichier isolé)', pieces['virus.pdf'].statutAnalyse === 'INFECTEE', pieces['virus.pdf'].motifRejet);
  verifier('.exe → REJETEE (format)', pieces['outil.exe'].statutAnalyse === 'REJETEE', pieces['outil.exe'].motifRejet);
  verifier('faux PDF (extension mensongère) → REJETEE', pieces['faux.pdf'].statutAnalyse === 'REJETEE');
  r = await red('GET', `/v1/actes/${id}/pieces/${ids['calendrier.pdf']}`, undefined, true);
  verifier('téléchargement de la pièce saine, octets identiques', r.status === 200 && r.body.equals(pdf));
  r = await red('POST', `/v1/actes/${id}/soumission`, { version: (await red('GET', `/v1/actes/${id}`)).body.version });
  verifier('soumission bloquée tant que des pièces refusées restent', r.status === 409 && r.body.code === 'PIECES_REFUSEES');
  for (const nom of ['virus.pdf', 'outil.exe', 'faux.pdf']) await red('DELETE', `/v1/actes/${id}/pieces/${ids[nom]}`);

  // Accès (RG-15)
  const autre = await session('MINESUP-02845');
  verifier('un autre rédacteur ne lit pas le brouillon', (await autre('GET', `/v1/actes/${id}`)).status === 403);
  const sg = await (async () => { try { return await session('MINESUP-03107'); } catch { return null; } })();
  verifier('un viseur hors circuit ne lit pas encore l’acte', (await sg('GET', `/v1/actes/${id}`)).status === 403);

  // BF-22 soumission
  acte = (await red('GET', `/v1/actes/${id}`)).body;
  r = await red('POST', `/v1/actes/${id}/soumission`, { version: acte.version });
  verifier('BF-22 soumission → EN_CIRCUIT, étape 1', r.status === 200 && r.body.statut === 'EN_CIRCUIT' && r.body.etape.ordre === 1, r.body.etape?.libelle);
  r = await red('PATCH', `/v1/actes/${id}`, { version: acte.version + 1, objet: 'après soumission' });
  verifier('plus modifiable une fois en circuit', r.status === 409 && r.body.code === 'ACTE_EN_CIRCUIT');
  verifier('RG-16 un acte soumis ne se supprime pas', (await red('DELETE', `/v1/actes/${id}`)).status === 409);

  // RG-16 brouillon jamais soumis
  r = await red('POST', '/v1/actes', { typeActeId: ns.id });
  verifier('RG-16 brouillon jamais soumis supprimé', (await red('DELETE', `/v1/actes/${r.body.id}`)).status === 204);

  // C1 Mes actes
  r = await red('GET', '/v1/actes');
  verifier('C1 « Mes actes » et compteurs', r.body.compteurs.enCircuit >= 1 && r.body.actes.some((a) => a.id === id && a.etapeCourante === 'Visa du chef de service'), JSON.stringify(r.body.compteurs));
  verifier('RBAC : l’auditrice ne liste pas d’actes à rédiger', (await (await session('MINESUP-07341'))('GET', '/v1/actes')).status === 403);

  // Audit
  const aud = await session('MINESUP-07341');
  r = await aud('GET', '/v1/audit?limite=50');
  const actions = new Set(r.body.map((e) => e.action));
  verifier('journal : création, pièces, soumission, suppression', ['acte.cree', 'piece.analysee', 'acte.soumis', 'acte.supprime'].every((a) => actions.has(a)));
  verifier('chaîne intègre', (await aud('GET', '/v1/audit/verification')).body.integre === true);

  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
