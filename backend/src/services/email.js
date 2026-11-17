import nodemailer from 'nodemailer';

function readEmailConfig() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || 'smtp';
  const from = process.env.EMAIL_FROM?.trim() ?? '';

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY?.trim() ?? '';
    return { provider, from, apiKey, configured: Boolean(apiKey && from), hasSettings: Boolean(apiKey || from) };
  }

  const host = process.env.SMTP_HOST?.trim() ?? '';
  const user = process.env.SMTP_USER?.trim() ?? '';
  const pass = process.env.SMTP_PASS ?? '';
  const port = Number(process.env.SMTP_PORT || 587);
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureValue ? secureValue === 'true' : port === 465;
  const credentialsMatch = Boolean(user) === Boolean(pass);
  const configured = provider === 'smtp' && Boolean(host && from && credentialsMatch && Number.isInteger(port) && port > 0 && port <= 65535);
  const hasSettings = provider !== 'smtp' || Boolean(host || from || user || pass);
  return { provider, host, from, user, pass, port, secure, configured, hasSettings };
}

export function emailDeliveryStatus() {
  const { configured, hasSettings } = readEmailConfig();
  return { configured, incomplete: hasSettings && !configured };
}

let cachedTransport;
let cachedConfigKey;

function getTransport(config) {
  const configKey = JSON.stringify({ host: config.host, from: config.from, user: config.user, pass: config.pass, port: config.port, secure: config.secure });
  if (!cachedTransport || cachedConfigKey !== configKey) {
    cachedTransport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      ...(config.user ? { auth: { user: config.user, pass: config.pass } } : {}),
    });
    cachedConfigKey = configKey;
  }
  return cachedTransport;
}

export async function sendVerificationEmail({ email, code, purpose = 'signup' }) {
  const config = readEmailConfig();
  if (!config.configured) throw new Error('Email delivery is not configured.');

  const isStudentLink = purpose === 'student-email-link';
  const subject = isStudentLink ? 'Link your college email to Campusly' : 'Your Campusly verification code';
  const heading = isStudentLink ? 'Link your college email' : 'Verify your Campusly email';
  const intro = isStudentLink
    ? 'Enter this code in Campusly to link this college email to your student account:'
    : 'Enter this code to finish creating your account:';
  const text = `${heading}. ${intro} ${code}. The code expires in 10 minutes. If you did not request it, ignore this email.`;
  const html = `<main style="font-family:Arial,sans-serif;color:#14223c;line-height:1.6"><h1 style="font-size:22px">${heading}</h1><p>${intro}</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></main>`;

  if (config.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.from, to: [email], subject, text, html }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Email API request failed (${response.status}).`);
    return;
  }

  await getTransport(config).sendMail({ from: config.from, to: email, subject, text, html });
}
