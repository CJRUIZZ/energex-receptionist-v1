import 'dotenv/config';

function cleanUrlValue(value, fallback) {
  const raw = String(value || fallback || '').trim();
  const withoutPrefix = raw.replace(/^APP_BASE_URL=/, '');
  return withoutPrefix.replace(/\/+$/, '');
}

export const env = {
  port: Number(process.env.PORT || 3000),
  appBaseUrl: cleanUrlValue(process.env.APP_BASE_URL, `http://localhost:${process.env.PORT || 3000}`),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  blandApiKey: process.env.BLAND_API_KEY || '',
  blandDefaultVoice: process.env.BLAND_DEFAULT_VOICE || 'maya',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
};

export function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
