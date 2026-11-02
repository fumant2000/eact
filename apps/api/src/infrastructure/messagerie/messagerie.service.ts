import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface Courriel {
  a: string;
  sujet: string;
  texte: string;
  html?: string;
}

/**
 * IMessagerie — adaptateur SMTP (nodemailer). En dev, SMTP_HOST pointe sur Mailpit :
 * aucun e-mail ne sort, tout est lisible sur http://localhost:8025.
 * P2 (M12) : l'envoi passera par la file BullMQ « notifications » (sémantique « au moins une fois », §16.3).
 */
@Injectable()
export class MessagerieService {
  private readonly logger = new Logger(MessagerieService.name);
  private readonly transport: Transporter = createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
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
