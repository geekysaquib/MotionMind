import nodemailer from 'nodemailer';
import { BRAND } from '@motionmind/shared';

export interface Mailer {
  sendLoginCode(to: string, code: string): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/** Sends through any SMTP server. For Gmail: smtp.gmail.com, port 465, and an app password. */
export class SmtpMailer implements Mailer {
  private readonly transport;

  constructor(private readonly cfg: SmtpConfig) {
    this.transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
  }

  async sendLoginCode(to: string, code: string) {
    await this.transport.sendMail({
      from: this.cfg.from,
      to,
      subject: `${code} is your ${BRAND.name} sign-in code`,
      text: `Your ${BRAND.name} sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<p>Your ${BRAND.name} sign-in code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
    });
  }
}

/** Local development without SMTP settings: the code is printed in the API terminal. */
export class ConsoleMailer implements Mailer {
  readonly sent: { to: string; code: string }[] = [];
  constructor(private readonly print = true) {}
  async sendLoginCode(to: string, code: string) {
    this.sent.push({ to, code });
    if (this.print) console.warn(`[dev] Sign-in code for ${to}: ${code}  (set SMTP_* in backend/.env to send real emails)`);
  }
}
