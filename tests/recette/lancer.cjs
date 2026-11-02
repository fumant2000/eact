// Lance les recettes de bout en bout, l'une après l'autre (elles partagent la base et Mailpit).
//   node tests/recette/lancer.cjs              → toutes, contre l’API de la démo complète (http://localhost:3000, sans nginx qui limite les connexions)
//   node tests/recette/lancer.cjs m05 m06      → seulement celles-ci
//   EACT_API=http://localhost:3001/api node tests/recette/lancer.cjs   → mode léger
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

// m01 en dernier : il change le mot de passe d'Abdou NJOYA et enrôle l'administrateur (base de dev uniquement).
const ORDRE = ['m04', 'm15', 'm05', 'm06', 'm02', 'm01'];
const choisies = process.argv.slice(2).length ? process.argv.slice(2) : ORDRE;
let echecs = 0;
for (const m of choisies) {
  console.log(`\n══════ Recette ${m.toUpperCase()} ══════`);
  const r = spawnSync(process.execPath, [join(__dirname, `recette-${m}.cjs`)], { stdio: 'inherit' });
  if (r.status !== 0) echecs++;
  spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 3000)']); // laisse partir les e-mails en tâche de fond
}
console.log(`\n${choisies.length - echecs} recette(s) au vert sur ${choisies.length}`);
process.exit(echecs ? 1 : 0);
