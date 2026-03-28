import { env } from '../lib/env.js';

export async function notifyTicketCreated({ email, sms, orgName, summary, urgency, callerPhone }) {
  const promises = [];
  if (email) promises.push(sendEmail({ email, orgName, summary, urgency, callerPhone }));
  if (sms) promises.push(sendSms({ sms, orgName, summary, urgency, callerPhone }));
  if (!promises.length) return;

  const results = await Promise.allSettled(promises);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`Notification ${i} failed:`, r.reason);
  });
}

async function sendEmail({ email, orgName, summary, urgency, callerPhone }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(`📧 [Email] To: ${email} | ${urgency} ticket for ${orgName}: ${summary} (from ${callerPhone})`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `EnergeX <tickets@${process.env.RESEND_DOMAIN || 'resend.dev'}>`,
      to: [email],
      subject: `New ${urgency} ticket — ${orgName}`,
      html: `<div style="font-family:sans-serif;max-width:500px">
        <h2 style="margin-bottom:8px">New support ticket</h2>
        <p style="color:#666;margin-bottom:20px">A caller needed help that required follow-up.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#999;width:100px">Urgency</td><td style="padding:8px 0;font-weight:600">${urgency}</td></tr>
          <tr><td style="padding:8px 0;color:#999">Caller</td><td style="padding:8px 0">${callerPhone || 'Unknown'}</td></tr>
          <tr><td style="padding:8px 0;color:#999">Summary</td><td style="padding:8px 0">${summary}</td></tr>
        </table></div>`,
    }),
  });

  if (!response.ok) throw new Error(`Resend error ${response.status}`);
  console.log('✓ Email notification sent to', email);
}

async function sendSms({ sms, orgName, summary, urgency, callerPhone }) {
  const message = `[EnergeX] New ${urgency} ticket for ${orgName}: "${summary}" — Caller: ${callerPhone || 'unknown'}`;

  if (!env.blandApiKey) {
    console.log(`📱 [SMS] To: ${sms} | ${message}`);
    return;
  }

  try {
    const response = await fetch('https://api.bland.ai/v1/sms/send', {
      method: 'POST',
      headers: { Authorization: env.blandApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: sms, message }),
    });

    if (!response.ok) {
      console.log(`📱 SMS fallback (Bland returned ${response.status}): To: ${sms} | ${message}`);
      return;
    }
    console.log('✓ SMS notification sent to', sms);
  } catch (err) {
    console.log(`📱 SMS fallback (${err.message}): To: ${sms} | ${message}`);
  }
}
