export const wizardSteps = [
  'Business',
  'Hours',
  'Services',
  'Routing',
  'Notifications',
  'FAQs',
  'Phone',
  'Review',
];

export function createEmptyWizardState() {
  return {
    business: {
      name: '',
      industry: '',
      website: '',
      summary: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      timezone: 'America/New_York',
      language: 'en',
      voiceId: 'maya',
      greeting: '',
    },
    hours: [
      { day: 'Monday', opensAt: '09:00', closesAt: '17:00', closed: false },
      { day: 'Tuesday', opensAt: '09:00', closesAt: '17:00', closed: false },
      { day: 'Wednesday', opensAt: '09:00', closesAt: '17:00', closed: false },
      { day: 'Thursday', opensAt: '09:00', closesAt: '17:00', closed: false },
      { day: 'Friday', opensAt: '09:00', closesAt: '17:00', closed: false },
      { day: 'Saturday', opensAt: '', closesAt: '', closed: true },
      { day: 'Sunday', opensAt: '', closesAt: '', closed: true },
    ],
    services: [''],
    commonQuestions: [''],
    routingRules: [{ departmentName: 'Front Desk', transferNumber: '', escalationLabel: '', notes: '' }],
    notifications: {
      email: '',
      sms: '',
    },
    faqs: [{ category: 'general', question: '', answer: '' }],
    phoneSetup: {
      existingNumber: '',
      twilioPhoneSid: '',
      twilioForwardNumber: '',
      blandAreaCode: '732',
    },
    escalationPolicy: 'If a question cannot be answered from the knowledge base or transferred live, create a ticket and tell the caller someone will follow up.',
  };
}

export function bundleToWizardState(bundle) {
  const base = createEmptyWizardState();
  if (!bundle?.org) return base;

  return {
    business: {
      ...base.business,
      name: bundle.org.name || '',
      industry: bundle.org.industry || '',
      website: bundle.org.website || '',
      contactName: bundle.org.contact_name || '',
      contactEmail: bundle.org.contact_email || '',
      contactPhone: bundle.org.contact_phone || '',
      timezone: bundle.org.timezone || 'America/New_York',
      language: bundle.org.language || 'en',
      voiceId: bundle.profile?.voice_id || 'maya',
      greeting: bundle.profile?.greeting || '',
      summary: bundle.profile?.business_summary || '',
    },
    hours: bundle.profile?.hours?.length ? bundle.profile.hours : base.hours,
    services: bundle.profile?.services?.length ? bundle.profile.services : [''],
    commonQuestions: bundle.profile?.common_questions?.length ? bundle.profile.common_questions : [''],
    routingRules: bundle.routingRules?.length
      ? bundle.routingRules.map((rule) => ({
          departmentName: rule.department_name || '',
          transferNumber: rule.transfer_number || '',
          escalationLabel: rule.escalation_label || '',
          notes: rule.notes || '',
        }))
      : base.routingRules,
    notifications: {
      email: bundle.profile?.notification_email || '',
      sms: bundle.profile?.notification_sms || '',
    },
    faqs: bundle.knowledgeEntries?.length
      ? bundle.knowledgeEntries.map((entry) => ({
          category: entry.category || 'general',
          question: entry.question || '',
          answer: entry.answer || '',
        }))
      : base.faqs,
    phoneSetup: {
      existingNumber: bundle.phoneConfig?.existing_number || bundle.org.business_phone || '',
      twilioPhoneSid: bundle.phoneConfig?.twilio_phone_sid || '',
      twilioForwardNumber: bundle.phoneConfig?.twilio_forward_number || '',
      blandAreaCode: '732',
    },
    escalationPolicy: bundle.profile?.escalation_policy || base.escalationPolicy,
  };
}
