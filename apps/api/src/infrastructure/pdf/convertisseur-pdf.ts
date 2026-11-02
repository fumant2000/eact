import { Injectable } from '@nestjs/common';

/** IConvertisseurPdf : HTML → PDF/A-2b par Gotenberg (BF-32, ENF-09). */
@Injectable()
export class ConvertisseurPdf {
  private readonly url = process.env.GOTENBERG_URL ?? 'http://gotenberg:3000';

  async htmlVersPdfA(html: string, piedDePage: string, pdfa = true): Promise<Buffer> {
    const form = new FormData();
    form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
    form.append('files', new Blob([piedDePage], { type: 'text/html' }), 'footer.html');
    if (pdfa) form.append('pdfa', 'PDF/A-2b'); // l'aperçu d'un projet n'a pas besoin d'être archivable
    form.append('paperWidth', '8.27'); // A4 en pouces
    form.append('paperHeight', '11.7');
    form.append('marginTop', '0.6');
    form.append('marginBottom', '0.8');
    form.append('marginLeft', '0.7');
    form.append('marginRight', '0.7');
    form.append('printBackground', 'true');
    form.append('metadata', JSON.stringify({ Creator: 'EACT — MINESUP', Producer: 'EACT (Gotenberg)' }));
    const r = await fetch(`${this.url}/forms/chromium/convert/html`, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`Gotenberg ${r.status} : ${(await r.text()).slice(0, 200)}`);
    return Buffer.from(await r.arrayBuffer());
  }
}
