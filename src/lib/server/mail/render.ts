import { createI18n } from '$lib/i18n';

export interface MergeValues {
	client_name: string;
	gallery_name: string;
	gallery_link: string;
	password: string;
	client_password: string;
	studio_name: string;
	event_date: string;
	expiry_date: string;
}

/** Replace {field} placeholders and tidy up what an empty field leaves behind ("Hi ," -> "Hi,"). */
export function mergeFields(template: string, values: MergeValues | Record<string, string>): string {
	return template
		.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? (values as Record<string, string>)[key] : match))
		.replace(/[ \t]+([,.!?;:])/g, '$1')
		.replace(/[ \t]{2,}/g, ' ');
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function linkify(escaped: string): string {
	return escaped.replace(
		/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
		'<a href="$1" style="color:inherit;text-decoration:underline">$1</a>'
	);
}

function paragraphs(message: string): string {
	return message
		.trim()
		.split(/\n{2,}/)
		.map(
			(block) =>
				`<p class="text" style="margin:0 0 18px;color:#1e1e1e;font-size:16px;line-height:1.65">${linkify(escapeHtml(block)).replace(/\n/g, '<br>')}</p>`
		)
		.join('');
}

export interface GalleryEmailContent {
	language: string;
	galleryName: string;
	eventDate: string;
	message: string;
	link: string;
	password: string | null;
	/** The client password, in its own box. */
	clientPassword?: string | null;
	studio: { name: string; email: string; website: string; phone: string };
	/** Label of the button (defaults to "View gallery"). */
	buttonLabel?: string;
	/** Image sources: "cid:…" when sending, regular URLs in the admin preview. */
	coverSrc: string | null;
	logoSrc: string | null;
}

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export function renderGalleryEmail(c: GalleryEmailContent): { html: string; text: string } {
	const { t } = createI18n(c.language);
	const preheader = c.message.trim().split('\n')[0] ?? '';
	const footerParts = [c.studio.name, c.studio.email, c.studio.phone, c.studio.website].filter(Boolean);

	const header = c.logoSrc
		? `<img src="${escapeHtml(c.logoSrc)}" alt="${escapeHtml(c.studio.name)}" height="44" style="display:inline-block;height:44px;width:auto;border:0">`
		: `<span class="muted" style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#666666">${escapeHtml(c.studio.name)}</span>`;

	const cover = c.coverSrc
		? `<tr><td style="padding:0"><img src="${escapeHtml(c.coverSrc)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>`
		: '';

	const box = (label: string, value: string) =>
		`<tr><td style="padding:0 40px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e1" class="box"><tr><td style="padding:14px 18px;font-family:${FONT}"><span class="muted" style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#666666">${escapeHtml(label)}</span><br><span class="text" style="font-size:18px;letter-spacing:0.06em;color:#1e1e1e;font-family:Menlo,Consolas,monospace">${escapeHtml(value)}</span></td></tr></table></td></tr>`;
	const password = (c.password ? box(t('email.password'), c.password) : '') + (c.clientPassword ? box(t('email.clientPassword'), c.clientPassword) : '');

	const html = `<!doctype html>
<html lang="${escapeHtml(c.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(c.galleryName)}</title>
<style>
	@media (prefers-color-scheme: dark) {
		.bg { background: #121212 !important; }
		.card { background: #1e1e1e !important; }
		.text { color: #f2f2f2 !important; }
		.muted { color: #a3a3a3 !important; }
		.box { border-color: #2c2c2c !important; }
		.btn { background: #f2f2f2 !important; color: #121212 !important; }
	}
	@media (max-width: 620px) {
		.pad { padding-left: 24px !important; padding-right: 24px !important; }
	}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#f4f4f2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f4f4f2">
<tr><td align="center" style="padding:32px 12px">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="max-width:600px;background:#ffffff;font-family:${FONT}">
		<tr><td class="pad" align="center" style="padding:32px 40px 8px">${header}</td></tr>
		<tr><td class="pad" align="center" style="padding:20px 40px 32px">
			<h1 class="text" style="margin:0;font-family:${FONT};font-size:26px;line-height:1.3;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#1e1e1e">${escapeHtml(c.galleryName)}</h1>
			${c.eventDate ? `<p class="muted" style="margin:10px 0 0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#666666">${escapeHtml(c.eventDate)}</p>` : ''}
		</td></tr>
		${cover}
		<tr><td class="pad" style="padding:36px 40px 10px;font-family:${FONT}">${paragraphs(c.message)}</td></tr>
		${password}
		<tr><td class="pad" align="center" style="padding:24px 40px 44px">
			<a href="${escapeHtml(c.link)}" class="btn" style="display:inline-block;background:#1e1e1e;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:13px;letter-spacing:0.18em;text-transform:uppercase;padding:17px 34px">${escapeHtml(c.buttonLabel ?? t('email.viewGallery'))}</a>
		</td></tr>
	</table>
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
		<tr><td align="center" class="muted" style="padding:20px 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:#666666">${footerParts.map(escapeHtml).join(' &middot; ')}</td></tr>
	</table>
</td></tr>
</table>
</body>
</html>`;

	const text = [
		c.galleryName.toUpperCase(),
		c.eventDate,
		'',
		c.message.trim(),
		'',
		`${c.buttonLabel ?? t('email.viewGallery')}: ${c.link}`,
		c.password ? `${t('email.password')}: ${c.password}` : '',
		c.clientPassword ? `${t('email.clientPassword')}: ${c.clientPassword}` : '',
		'',
		'--',
		footerParts.join(' · ')
	]
		.filter((line, i, all) => !(line === '' && all[i - 1] === ''))
		.join('\n');

	return { html, text };
}
