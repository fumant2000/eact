import { Socket } from 'node:net';

export type ResultatAnalyse = { sain: true } | { sain: false; menace: string };

/** IAntivirus (RG-24). ClamAV en conteneurs ; simulé en mode léger (ANTIVIRUS=simule). */
export abstract class Antivirus {
  abstract analyser(contenu: Buffer): Promise<ResultatAnalyse>;
}

/**
 * Mode léger : refuse le fichier de test standard EICAR, accepte le reste.
 * Permet de montrer en séance le blocage d'une pièce (C5 « Bloqué : menace détectée ») sans ClamAV.
 */
export class AntivirusSimule extends Antivirus {
  private static readonly EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

  async analyser(contenu: Buffer): Promise<ResultatAnalyse> {
    await new Promise((r) => setTimeout(r, 1500)); // durée d'analyse visible à l'écran
    return contenu.includes(AntivirusSimule.EICAR) ? { sain: false, menace: 'Eicar-Test-Signature' } : { sain: true };
  }
}

/** Protocole clamd INSTREAM : blocs préfixés par leur taille (4 octets big-endian), terminés par un bloc vide. */
export class AntivirusClamav extends Antivirus {
  analyser(contenu: Buffer): Promise<ResultatAnalyse> {
    return new Promise((resoudre, rejeter) => {
      const socket = new Socket();
      let reponse = '';
      socket.setTimeout(60_000, () => socket.destroy(new Error('ClamAV : délai dépassé')));
      socket.on('data', (d) => (reponse += d.toString()));
      socket.on('error', rejeter);
      socket.on('close', () => {
        // « stream: OK » ou « stream: Eicar-Test-Signature FOUND »
        const r = reponse.replace(/\0/g, '').trim();
        if (r.endsWith('OK')) resoudre({ sain: true });
        else if (r.endsWith('FOUND')) resoudre({ sain: false, menace: r.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '') });
        else rejeter(new Error(`ClamAV : réponse inattendue « ${r} »`));
      });
      socket.connect(Number(process.env.CLAMAV_PORT ?? 3310), process.env.CLAMAV_HOST ?? 'localhost', () => {
        socket.write('zINSTREAM\0');
        for (let i = 0; i < contenu.length; i += 64 * 1024) {
          const bloc = contenu.subarray(i, i + 64 * 1024);
          const taille = Buffer.alloc(4);
          taille.writeUInt32BE(bloc.length);
          socket.write(Buffer.concat([taille, bloc]));
        }
        socket.end(Buffer.alloc(4));
      });
    });
  }
}
