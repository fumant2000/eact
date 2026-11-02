import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/** IStockage : le métier ne manipule que des clés ; S3 en conteneurs, disque local en mode léger. */
export abstract class Stockage {
  abstract ecrire(cle: string, contenu: Buffer, typeMime: string): Promise<void>;
  abstract lire(cle: string): Promise<Buffer>;
  abstract supprimer(cle: string): Promise<void>;
}

export class StockageLocal extends Stockage {
  private readonly racine = resolve(process.env.STOCKAGE_LOCAL_DIR ?? './.stockage');

  private chemin(cle: string): string {
    const chemin = resolve(join(this.racine, cle));
    if (!chemin.startsWith(this.racine + sep)) throw new Error('Clé de stockage invalide'); // pas de « ../ »
    return chemin;
  }

  async ecrire(cle: string, contenu: Buffer) {
    const chemin = this.chemin(cle);
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, contenu);
  }

  lire(cle: string) {
    return readFile(this.chemin(cle));
  }

  async supprimer(cle: string) {
    await rm(this.chemin(cle), { force: true });
  }
}

export class StockageS3 extends Stockage {
  private readonly client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? '', secretAccessKey: process.env.S3_SECRET_KEY ?? '' },
  });
  private readonly bucket = process.env.S3_BUCKET_PIECES ?? 'pieces';

  async ecrire(cle: string, contenu: Buffer, typeMime: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: cle, Body: contenu, ContentType: typeMime }));
  }

  async lire(cle: string) {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: cle }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async supprimer(cle: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: cle }));
  }
}
