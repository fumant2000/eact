import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** Chiffrement au repos des secrets (BF-66, ENF-06) : AES-256-GCM, stocké en base64(iv | tag | chiffré). */
@Injectable()
export class ChiffrementService {
  private readonly cle: Buffer;

  constructor() {
    const secret = process.env.SECRETS_ENCRYPTION_KEY;
    if (!secret) throw new Error('SECRETS_ENCRYPTION_KEY manquant');
    this.cle = createHash('sha256').update(secret).digest();
  }

  chiffrer(clair: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.cle, iv);
    const chiffre = Buffer.concat([cipher.update(clair, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), chiffre]).toString('base64');
  }

  dechiffrer(stocke: string): string {
    const brut = Buffer.from(stocke, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.cle, brut.subarray(0, 12));
    decipher.setAuthTag(brut.subarray(12, 28));
    return Buffer.concat([decipher.update(brut.subarray(28)), decipher.final()]).toString('utf8');
  }
}
