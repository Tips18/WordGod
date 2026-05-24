import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { SmtpEmailSender } from './email-sender';

type SendMail = (
  options: nodemailer.SendMailOptions,
) => Promise<{ messageId: string }>;

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('SmtpEmailSender', () => {
  it('sends an email code through the configured SMTP transport', async () => {
    let capturedMailOptions: nodemailer.SendMailOptions | null = null;
    const sendMail = jest.fn<SendMail>(
      (options: nodemailer.SendMailOptions) => {
        capturedMailOptions = options;
        return Promise.resolve({ messageId: 'message-1' });
      },
    );
    const createTransport = jest.mocked(nodemailer.createTransport);

    createTransport.mockReturnValue({
      sendMail,
    } as nodemailer.Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    >);
    const sender = new SmtpEmailSender({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      user: 'smtp-user',
      pass: 'smtp-pass',
      from: 'WordGod <noreply@example.com>',
    });

    await sender.sendEmailCode({
      email: 'reader@example.com',
      purpose: 'login',
      code: '123456',
      expiresInMinutes: 10,
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(capturedMailOptions).toMatchObject({
      from: 'WordGod <noreply@example.com>',
      to: 'reader@example.com',
      subject: '我不是词神验证码',
    });
    expect(capturedMailOptions?.text).toEqual(
      expect.stringContaining('123456'),
    );
  });
});
