import twilio from 'twilio';
import { env } from '../lib/env.js';

function getClient() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    return null;
  }
  return twilio(env.twilioAccountSid, env.twilioAuthToken);
}

export async function configureTwilioForwarding({ phoneSid, voiceUrl }) {
  const client = getClient();
  if (!client) {
    throw new Error('Twilio credentials are not configured');
  }
  if (!phoneSid) {
    throw new Error('Twilio phone SID is required to configure forwarding');
  }

  const result = await client.incomingPhoneNumbers(phoneSid).update({
    voiceUrl,
    voiceMethod: 'POST',
  });

  return {
    sid: result.sid,
    phoneNumber: result.phoneNumber,
  };
}

export function buildForwardingInstructions({ existingNumber, blandNumber, voiceUrl, twilioPhoneSid }) {
  if (twilioPhoneSid) {
    return `Twilio phone SID ${twilioPhoneSid} is configured to use ${voiceUrl}. Inbound calls will be dialed through to ${blandNumber}.`;
  }

  return [
    'Twilio setup still needs one manual step.',
    existingNumber ? `Existing number: ${existingNumber}.` : 'No existing number was provided.',
    blandNumber ? `Bland number ready: ${blandNumber}.` : 'Bland number has not been provisioned yet.',
    `Connect the client number to a Twilio voice URL pointing at ${voiceUrl}, or configure call forwarding into the Twilio/Bland path manually.`,
  ].join(' ');
}

export function buildVoiceResponseXml(blandNumber) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${blandNumber}</Dial></Response>`;
}
