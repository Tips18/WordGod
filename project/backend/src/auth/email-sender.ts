import type { EmailCodePurpose } from '@word-god/contracts';
import nodemailer from 'nodemailer';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export interface SendEmailCodeMessage {
  email: string;
  purpose: EmailCodePurpose;
  code: string;
  expiresInMinutes: number;
}

export interface SmtpEmailSenderConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * `EmailSender` 定义验证码邮件发送适配器接口。
 */
export interface EmailSender {
  sendEmailCode(message: SendEmailCodeMessage): Promise<void>;
}

/**
 * `ConsoleEmailSender` 在本地开发环境把验证码输出到后端日志。
 */
export class ConsoleEmailSender implements EmailSender {
  /**
   * `sendEmailCode` 输出收件邮箱、用途和验证码供本地调试使用。
   */
  sendEmailCode(message: SendEmailCodeMessage): Promise<void> {
    console.info(
      `[email-code] email=${message.email} purpose=${message.purpose} code=${message.code} expiresInMinutes=${message.expiresInMinutes}`,
    );
    return Promise.resolve();
  }
}

/**
 * `SmtpEmailSender` 使用 SMTP 服务真实发送邮箱验证码。
 */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: nodemailer.Transporter;

  /**
   * `constructor` 初始化 SMTP 连接和发件人配置。
   */
  constructor(private readonly config: SmtpEmailSenderConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  /**
   * `sendEmailCode` 通过 SMTP 投递包含验证码和有效期的邮件。
   */
  async sendEmailCode(message: SendEmailCodeMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to: message.email,
      subject: '我不是词神验证码',
      text: this.createText(message),
    });
  }

  /**
   * `createText` 生成验证码邮件的纯文本正文。
   */
  private createText(message: SendEmailCodeMessage): string {
    const purposeText =
      message.purpose === 'register'
        ? '注册账号'
        : message.purpose === 'login'
          ? '验证码登录'
          : '重置密码';

    return [
      `你的验证码是：${message.code}`,
      '',
      `用途：${purposeText}`,
      `有效期：${message.expiresInMinutes} 分钟`,
      '',
      '如果不是你本人操作，请忽略这封邮件。',
    ].join('\n');
  }
}
