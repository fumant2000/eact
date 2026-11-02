// Gabarit HTML de l'acte signé (maquette E5, annexe A), converti en PDF/A-2b par Gotenberg.
import { LIBELLES_STRUCTURES, TITRES_TYPES } from '@eact/shared';

export interface DonneesActeSigne {
  codeType: string;
  reference: string;
  objet: string;
  contenuHtml: string; // déjà nettoyé (sanitize-html) à l'enregistrement
  chaineStructures: string[];
  ampliations: string[];
  signeLe: Date;
  signataireNom: string;
  qualite: string; // « LE MINISTRE » ou la mention de délégation
  codeVerification: string;
  empreinteTexte: string;
  urlVerification: string;
  qrCode: string; // data URL PNG
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const FUSEAU = 'Africa/Douala'; // WAT, heure du serveur (§16.4)

/** « 1er novembre 2026 » */
export function dateLongue(d: Date): string {
  const parties = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(d);
  return parties.map((p) => (p.type === 'day' && p.value === '1' ? '1er' : p.value)).join('');
}

/** « 01/11/2026 10:42:18 WAT » */
export function horodatage(d: Date): string {
  return `${new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, dateStyle: 'short', timeStyle: 'medium' }).format(d).replace(',', '')} WAT`;
}

export function htmlActeSigne(a: DonneesActeSigne): string {
  const colonne = (l: 'fr' | 'en') => `
    <div class="col">
      <p class="b">${l === 'fr' ? 'RÉPUBLIQUE DU CAMEROUN' : 'REPUBLIC OF CAMEROON'}</p>
      <p>${l === 'fr' ? 'Paix – Travail – Patrie' : 'Peace – Work – Fatherland'}</p>
      <p>———</p>
      <p class="b">${l === 'fr' ? "MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR" : 'MINISTRY OF HIGHER EDUCATION'}</p>
      ${a.chaineStructures.map((c) => `<p>${echapper(LIBELLES_STRUCTURES[c]?.[l] ?? c)}</p>`).join('')}
    </div>`;
  const titre = TITRES_TYPES[a.codeType]?.fr ?? a.codeType;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)} ${echapper(a.reference)}</title>
<style>
  @page { size: A4; }
  body { font-family: 'Source Serif 4', 'Liberation Serif', 'DejaVu Serif', Georgia, serif; color: #1a2033; font-size: 12.5pt; line-height: 1.55; margin: 0; }
  p { margin: 0; }
  .mono { font-family: 'JetBrains Mono', 'DejaVu Sans Mono', monospace; }
  .sans { font-family: Inter, 'Liberation Sans', 'DejaVu Sans', Arial, sans-serif; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; font-size: 10pt; text-align: center; line-height: 1.4; }
  .col { width: 42%; } .b { font-weight: 700; }
  .armoiries { width: 70px; height: 70px; border: 1px dashed #b6c1e8; border-radius: 6px; font-size: 8pt; color: #5b6478; display: flex; align-items: center; justify-content: center; }
  h1 { text-align: center; font-size: 16pt; margin: 28px 0 6px; letter-spacing: .5px; }
  .objet { text-align: center; font-style: italic; margin-bottom: 22px; }
  .corps p { margin: 0 0 9px; text-align: justify; }
  .corps h2 { text-align: center; font-size: 13pt; margin: 14px 0 8px; letter-spacing: 1px; }
  .corps ul { margin: 0 0 9px 22px; }
  .bas { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
  .ampl { font-size: 11pt; } .ampl .t { font-weight: 700; text-decoration: underline; margin-bottom: 4px; }
  .sig { width: 46%; text-align: center; }
  .cachet { margin-top: 10px; border: 1.5px solid #d9a441; background: #fbf3e2; border-radius: 6px; padding: 8px 12px; text-align: left; }
  .cachet .e { font-size: 8.5pt; letter-spacing: 1px; color: #8a6116; font-weight: 700; }
  .verif { display: flex; gap: 16px; align-items: center; margin-top: 36px; padding-top: 14px; border-top: 1px solid #cdd2de; page-break-inside: avoid; font-size: 9pt; color: #5b6478; }
  .verif img { width: 92px; height: 92px; border: 1.5px solid #d9a441; padding: 4px; }
  .verif strong { color: #1a2033; font-size: 10pt; }
</style></head>
<body>
  <div class="entete">${colonne('fr')}<div class="armoiries">[Armoiries]</div>${colonne('en')}</div>
  <h1>${echapper(titre)} N° <span class="mono">${echapper(a.reference.replace(/^N°\s*/, ''))}</span></h1>
  <p class="objet">${echapper(a.objet)}</p>
  <div class="corps">${a.contenuHtml}</div>
  <div class="bas">
    <div class="ampl"><p class="t">Ampliations :</p>${a.ampliations.map((x) => `<p>– ${echapper(x)}</p>`).join('')}</div>
    <div class="sig">
      <p>Yaoundé, le ${dateLongue(a.signeLe)}</p>
      <p class="b" style="margin-top:6px">${echapper(a.qualite)}</p>
      <div class="cachet sans">
        <p class="e">SIGNÉ ÉLECTRONIQUEMENT</p>
        <p style="font-size:12pt;font-weight:600">${echapper(a.signataireNom)}</p>
        <p class="mono" style="font-size:9pt;color:#5b6478">${horodatage(a.signeLe)}</p>
      </div>
    </div>
  </div>
  <div class="verif sans">
    <img src="${a.qrCode}" alt="QR de vérification">
    <div>
      <p><strong>Vérifier l'authenticité de cet acte</strong></p>
      <p>Scannez le QR code ou rendez-vous sur ${echapper(a.urlVerification.replace(/\/[^/]+$/, ''))} avec le code court <strong class="mono">${a.codeVerification}</strong>.</p>
      <p class="mono" style="font-size:7.5pt;margin-top:4px">Empreinte du texte (SHA-256) : ${a.empreinteTexte}</p>
    </div>
  </div>
</body></html>`;
}

/** Pied de page Gotenberg : numérotation des pages (les classes pageNumber / totalPages sont remplies par Chromium). */
export const PIED_DE_PAGE = `<html><head><style>
  body { font-family: Arial, sans-serif; font-size: 8pt; color: #5b6478; width: 100%; margin: 0 0.7in; text-align: right; }
</style></head><body>Page <span class="pageNumber"></span> / <span class="totalPages"></span></body></html>`;
