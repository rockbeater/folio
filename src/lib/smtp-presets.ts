import type { MessageKey } from '$lib/i18n';

export interface SmtpPreset {
	id: string;
	name: string;
	host: string;
	port: number;
	security: 'starttls' | 'tls';
	/** Short hint about username/password for this provider. */
	hint: MessageKey;
}

/** Common email providers, to pre-fill the SMTP form. Values follow each provider's documentation. */
export const SMTP_PRESETS: SmtpPreset[] = [
	{ id: 'google', name: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, security: 'starttls', hint: 'admin.smtp.hint.google' },
	{ id: 'microsoft', name: 'Microsoft 365', host: 'smtp.office365.com', port: 587, security: 'starttls', hint: 'admin.smtp.hint.microsoft' },
	{ id: 'outlook', name: 'Outlook.com', host: 'smtp-mail.outlook.com', port: 587, security: 'starttls', hint: 'admin.smtp.hint.microsoft' },
	{ id: 'icloud', name: 'iCloud Mail', host: 'smtp.mail.me.com', port: 587, security: 'starttls', hint: 'admin.smtp.hint.icloud' },
	{ id: 'brevo', name: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, security: 'starttls', hint: 'admin.smtp.hint.service' },
	{ id: 'postmark', name: 'Postmark', host: 'smtp.postmarkapp.com', port: 587, security: 'starttls', hint: 'admin.smtp.hint.service' },
	{ id: 'mailgun', name: 'Mailgun', host: 'smtp.mailgun.org', port: 587, security: 'starttls', hint: 'admin.smtp.hint.service' },
	{ id: 'sendgrid', name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, security: 'starttls', hint: 'admin.smtp.hint.sendgrid' },
	{ id: 'simply', name: 'Simply.com', host: 'smtp.simply.com', port: 587, security: 'starttls', hint: 'admin.smtp.hint.mailbox' },
	{ id: 'onecom', name: 'One.com', host: 'send.one.com', port: 465, security: 'tls', hint: 'admin.smtp.hint.mailbox' }
];
