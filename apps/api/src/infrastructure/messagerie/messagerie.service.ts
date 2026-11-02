import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface Courriel {
  a: string;
  sujet: string;
  texte: string;
  html?: string;
}

/** IMessagerie : adaptateur SMTP (Mailpit en développement). */
@Injectable()
export class MessagerieService {
  private readonly logger = new Logger(MessagerieService.name);
  private readonly transport: Transporter = createTransport({
    host: process.env.SMTP_HOST ?? '127.0.0.1', // pas « localhost » : évite un essai IPv6 lent à chaque envoi
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    pool: true,
  });

  async envoyer(c: Courriel): Promise<void> {
    await this.transport.sendMail({
      from: process.env.MAIL_FROM ?? 'EACT MINESUP <ne-pas-repondre@eact.test>',
      to: c.a,
      subject: c.sujet,
      text: c.texte,
      html: c.html,
    });
    this.logger.log(`Courriel « ${c.sujet} » envoyé`);
  }
}
