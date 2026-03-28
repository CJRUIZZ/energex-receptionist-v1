import { wizardSteps } from '../lib/defaultState.js';

function StepField({ label, hint, children }) {
  return (
    <label className="step-field">
      <span className="step-field-label">{label}</span>
      {hint ? <span className="step-field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

function TextInput({ label, value, onChange, placeholder, hint, type = 'text' }) {
  return (
    <StepField label={label} hint={hint}>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </StepField>
  );
}

function TextArea({ label, value, onChange, placeholder, hint }) {
  return (
    <StepField label={label} hint={hint}>
      <textarea rows="4" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </StepField>
  );
}

function LaunchPreview({ draft, step, editing, mode }) {
  const previewFaqs = draft.faqs.filter((item) => item.question && item.answer).slice(0, 3);
  const readyChecks = [
    Boolean(draft.business.name),
    Boolean(draft.routingRules.find((rule) => rule.departmentName && rule.transferNumber)),
    Boolean(draft.faqs.find((item) => item.question && item.answer)),
    Boolean(draft.phoneSetup.existingNumber),
  ];

  const readiness = readyChecks.filter(Boolean).length;

  return (
    <aside className="launch-preview">
      <div className="preview-panel">
        <p className="eyebrow">{mode === 'settings' ? 'Settings preview' : editing ? 'Live edit context' : 'Launch preview'}</p>
        <h3>{draft.business.name || 'New receptionist'}</h3>
        <p className="preview-lead">
          {draft.business.greeting || 'Your receptionist greeting will appear here as the team configures the launch.'}
        </p>

        <div className="preview-stat-grid">
          <div>
            <span>Current step</span>
            <strong>{wizardSteps[step]}</strong>
          </div>
          <div>
            <span>Readiness</span>
            <strong>{readiness}/4</strong>
          </div>
        </div>
      </div>

      <div className="preview-panel">
        <p className="preview-label">Routing snapshot</p>
        {draft.routingRules.filter((rule) => rule.departmentName || rule.transferNumber).length ? (
          draft.routingRules
            .filter((rule) => rule.departmentName || rule.transferNumber)
            .slice(0, 4)
            .map((rule, index) => (
              <div className="preview-row" key={`${rule.departmentName}-${index}`}>
                <span>{rule.departmentName || 'Unnamed route'}</span>
                <small>{rule.transferNumber || 'No number'}</small>
              </div>
            ))
        ) : (
          <div className="preview-empty">No departments configured yet.</div>
        )}
      </div>

      <div className="preview-panel">
        <p className="preview-label">Knowledge snapshot</p>
        {previewFaqs.length ? (
          previewFaqs.map((faq, index) => (
            <div className="preview-faq" key={`${faq.question}-${index}`}>
              <strong>{faq.question}</strong>
              <p>{faq.answer}</p>
            </div>
          ))
        ) : (
          <div className="preview-empty">No FAQ answers written yet.</div>
        )}
      </div>

      <div className="preview-panel">
        <p className="preview-label">Number activation</p>
        <div className="preview-row">
          <span>Existing number</span>
          <small>{draft.phoneSetup.existingNumber || 'Pending'}</small>
        </div>
        <div className="preview-row">
          <span>Twilio handoff</span>
          <small>{draft.phoneSetup.twilioPhoneSid ? 'Configured' : 'Action required'}</small>
        </div>
      </div>
    </aside>
  );
}

function ReviewStep({ draft }) {
  return (
    <div className="review-grid">
      <div className="review-card-large">
        <p className="preview-label">Business</p>
        <h3>{draft.business.name || 'Unnamed business'}</h3>
        <p>{draft.business.industry || 'Industry pending'}</p>
        <p>{draft.business.summary || 'No business summary yet.'}</p>
      </div>
      <div className="review-card-large">
        <p className="preview-label">Launch checklist</p>
        <ul className="review-list">
          <li>{draft.hours.filter((row) => !row.closed).length} open business days configured</li>
          <li>{draft.services.filter(Boolean).length} services listed</li>
          <li>{draft.routingRules.filter((rule) => rule.departmentName && rule.transferNumber).length} routing destinations</li>
          <li>{draft.faqs.filter((faq) => faq.question && faq.answer).length} FAQ entries</li>
        </ul>
      </div>
      <div className="review-card-large">
        <p className="preview-label">Notifications + escalation</p>
        <p>Email: {draft.notifications.email || 'Not set'}</p>
        <p>SMS: {draft.notifications.sms || 'Not set'}</p>
        <p>{draft.escalationPolicy}</p>
      </div>
      <div className="review-card-large">
        <p className="preview-label">Phone setup</p>
        <p>Existing number: {draft.phoneSetup.existingNumber || 'Not set'}</p>
        <p>Twilio phone SID: {draft.phoneSetup.twilioPhoneSid || 'Not set'}</p>
        <p>Bland area code: {draft.phoneSetup.blandAreaCode || '732'}</p>
      </div>
    </div>
  );
}

export default function OnboardingWizard({
  step,
  draft,
  setDraft,
  onStepChange,
  onSubmit,
  submitting,
  editing,
  mode = 'launch',
}) {
  const setBusiness = (key, value) => setDraft((prev) => ({ ...prev, business: { ...prev.business, [key]: value } }));
  const setNotifications = (key, value) => setDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: value } }));
  const setPhoneSetup = (key, value) => setDraft((prev) => ({ ...prev, phoneSetup: { ...prev.phoneSetup, [key]: value } }));

  const updateList = (key, index, value) =>
    setDraft((prev) => {
      const next = [...prev[key]];
      next[index] = value;
      return { ...prev, [key]: next };
    });

  const addListRow = (key, value = '') => setDraft((prev) => ({ ...prev, [key]: [...prev[key], value] }));

  const updateHour = (index, key, value) =>
    setDraft((prev) => ({
      ...prev,
      hours: prev.hours.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    }));

  const updateRoute = (index, key, value) =>
    setDraft((prev) => ({
      ...prev,
      routingRules: prev.routingRules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [key]: value } : rule)),
    }));

  const addRoute = () =>
    setDraft((prev) => ({
      ...prev,
      routingRules: [...prev.routingRules, { departmentName: '', transferNumber: '', escalationLabel: '', notes: '' }],
    }));

  const updateFaq = (index, key, value) =>
    setDraft((prev) => ({
      ...prev,
      faqs: prev.faqs.map((faq, faqIndex) => (faqIndex === index ? { ...faq, [key]: value } : faq)),
    }));

  const addFaq = () =>
    setDraft((prev) => ({
      ...prev,
      faqs: [...prev.faqs, { category: 'general', question: '', answer: '' }],
    }));

  const isSettings = mode === 'settings';

  if (isSettings && !editing) {
    return (
      <section className="surface launch-main">
        <div className="section-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>No live receptionist loaded</h2>
            <p className="section-description">
              Launch a receptionist first. After that, this tab becomes the place to edit hours, routing, FAQs, phone setup, and all other live configuration.
            </p>
          </div>
        </div>
        <div className="empty-state">There is nothing to edit yet because no existing receptionist is loaded into this workspace.</div>
      </section>
    );
  }

  return (
    <div className="launch-layout">
      <section className="surface launch-main">
        <div className="launch-top">
          <div>
            <p className="eyebrow">{isSettings ? 'Settings' : editing ? 'Refine and relaunch' : 'Guided launch'}</p>
            <h2>
              {isSettings
                ? 'Edit the live receptionist settings'
                : editing
                  ? 'Update the live receptionist configuration'
                  : 'Create a new receptionist with a guided launch flow'}
            </h2>
            <p className="section-description">
              {isSettings
                ? 'Everything the receptionist relies on lives here: business context, hours, routing, escalation logic, FAQs, and phone setup.'
                : 'Each step focuses on one part of the brief so the final sync is clearer, cleaner, and easier to review before the agent goes live.'}
            </p>
          </div>
          <div className="step-progress">
            <span>
              Step {step + 1} of {wizardSteps.length}: {wizardSteps[step]}
            </span>
            <div className="progress-bar">
              <span style={{ width: `${((step + 1) / wizardSteps.length) * 100}%` }}></span>
            </div>
          </div>
        </div>

        {step === 0 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Start with the business brief.</h3>
              <p>Give the receptionist enough context to answer naturally before you configure anything operational.</p>
            </div>
            <div className="grid two">
              <TextInput label="Business name" value={draft.business.name} onChange={(value) => setBusiness('name', value)} placeholder="Downtown Dental" />
              <TextInput label="Industry" value={draft.business.industry} onChange={(value) => setBusiness('industry', value)} placeholder="Dental, legal, home services" />
              <TextInput label="Website" value={draft.business.website} onChange={(value) => setBusiness('website', value)} placeholder="https://example.com" />
              <TextInput label="Contact name" value={draft.business.contactName} onChange={(value) => setBusiness('contactName', value)} placeholder="Owner or manager" />
              <TextInput label="Contact email" type="email" value={draft.business.contactEmail} onChange={(value) => setBusiness('contactEmail', value)} placeholder="owner@example.com" />
              <TextInput label="Contact phone" value={draft.business.contactPhone} onChange={(value) => setBusiness('contactPhone', value)} placeholder="(732) 555-0100" />
              <TextInput
                label="Timezone"
                value={draft.business.timezone}
                onChange={(value) => setBusiness('timezone', value)}
                placeholder="America/New_York"
                hint="This controls how business hours and time-based answers are interpreted."
              />
              <div className="grid-span-2">
                <TextArea label="Business summary" value={draft.business.summary} onChange={(value) => setBusiness('summary', value)} placeholder="What should the receptionist know about this business?" />
              </div>
              <div className="grid-span-2">
                <TextArea label="Greeting" value={draft.business.greeting} onChange={(value) => setBusiness('greeting', value)} placeholder="Thanks for calling..." hint="This becomes the opener the receptionist uses when a call begins." />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Define when the business is available.</h3>
              <p>This powers scheduling questions, after-hours handling, and caller expectations.</p>
            </div>
            <div className="stack">
              {draft.hours.map((row, index) => (
                <div key={row.day} className="row hour-row">
                  <strong>{row.day}</strong>
                  <label className="checkbox">
                    <input type="checkbox" checked={row.closed} onChange={(e) => updateHour(index, 'closed', e.target.checked)} />
                    Closed
                  </label>
                  <input type="time" value={row.opensAt} disabled={row.closed} onChange={(e) => updateHour(index, 'opensAt', e.target.value)} />
                  <input type="time" value={row.closesAt} disabled={row.closed} onChange={(e) => updateHour(index, 'closesAt', e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Teach the receptionist what callers ask about.</h3>
              <p>List services first, then the most common intents you expect callers to bring up.</p>
            </div>
            <div className="grid two">
              <div className="stack">
                <div className="section-subhead">Services</div>
                {draft.services.map((item, index) => (
                  <TextInput key={`service-${index}`} label={`Service ${index + 1}`} value={item} onChange={(value) => updateList('services', index, value)} placeholder="Emergency plumbing" />
                ))}
                <button className="ghost-button" onClick={() => addListRow('services')}>
                  Add service
                </button>
              </div>
              <div className="stack">
                <div className="section-subhead">Common caller intents</div>
                {draft.commonQuestions.map((item, index) => (
                  <TextInput key={`question-${index}`} label={`Intent ${index + 1}`} value={item} onChange={(value) => updateList('commonQuestions', index, value)} placeholder="Do you take same-day appointments?" />
                ))}
                <button className="ghost-button" onClick={() => addListRow('commonQuestions')}>
                  Add intent
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Define the live handoff paths.</h3>
              <p>Only add departments that are actually able to receive transferred calls.</p>
            </div>
            <div className="stack">
              {draft.routingRules.map((rule, index) => (
                <div key={`route-${index}`} className="routing-card">
                  <TextInput label="Department" value={rule.departmentName} onChange={(value) => updateRoute(index, 'departmentName', value)} placeholder="Billing" hint="Only add teams that can receive live transfers." />
                  <TextInput label="Transfer number" value={rule.transferNumber} onChange={(value) => updateRoute(index, 'transferNumber', value)} placeholder="+17325550100" />
                  <TextInput label="Escalation label" value={rule.escalationLabel} onChange={(value) => updateRoute(index, 'escalationLabel', value)} placeholder="Urgent billing issue" hint="This is the internal reason attached to a live handoff or fallback." />
                  <TextArea label="Routing notes" value={rule.notes} onChange={(value) => updateRoute(index, 'notes', value)} placeholder="Use this route for payment questions, insurance questions, and invoices." hint="Write this the way you want the agent to understand when the route should be used." />
                </div>
              ))}
              <button className="ghost-button" onClick={addRoute}>
                Add department
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Decide how the human team gets pulled in.</h3>
              <p>These settings control who gets notified and how the AI escalates when it cannot resolve the caller alone.</p>
            </div>
            <div className="grid two">
              <TextInput label="Ticket notification email" value={draft.notifications.email} onChange={(value) => setNotifications('email', value)} placeholder="ops@example.com" />
              <TextInput label="Ticket notification SMS" value={draft.notifications.sms} onChange={(value) => setNotifications('sms', value)} placeholder="+17325550100" />
              <div className="grid-span-2">
                <TextArea label="Escalation policy" value={draft.escalationPolicy} onChange={(value) => setDraft((prev) => ({ ...prev, escalationPolicy: value }))} placeholder="When should the receptionist create a ticket?" />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Write the knowledge base in plain English.</h3>
              <p>Use direct questions and concrete answers. This becomes the receptionist’s fastest path to solving callers without escalation.</p>
            </div>
            <div className="stack">
              {draft.faqs.map((faq, index) => (
                <div key={`faq-${index}`} className="routing-card">
                  <TextInput label="Category" value={faq.category} onChange={(value) => updateFaq(index, 'category', value)} placeholder="pricing" />
                  <TextInput label="Question" value={faq.question} onChange={(value) => updateFaq(index, 'question', value)} placeholder="What are your office hours?" />
                  <TextArea label="Answer" value={faq.answer} onChange={(value) => updateFaq(index, 'answer', value)} placeholder="We are open Monday through Friday..." />
                </div>
              ))}
              <button className="ghost-button" onClick={addFaq}>
                  Add FAQ entry
                </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Track number handoff and launch dependencies.</h3>
              <p>The system will try to provision what it can, but this step should make any remaining Twilio or forwarding work obvious.</p>
            </div>
            <div className="grid two">
              <TextInput label="Existing business number" value={draft.phoneSetup.existingNumber} onChange={(value) => setPhoneSetup('existingNumber', value)} placeholder="+17328373689" />
              <TextInput label="Twilio phone SID" value={draft.phoneSetup.twilioPhoneSid} onChange={(value) => setPhoneSetup('twilioPhoneSid', value)} placeholder="PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
              <TextInput label="Twilio forward number" value={draft.phoneSetup.twilioForwardNumber} onChange={(value) => setPhoneSetup('twilioForwardNumber', value)} placeholder="+17325551234" />
              <TextInput label="Preferred Bland area code" value={draft.phoneSetup.blandAreaCode} onChange={(value) => setPhoneSetup('blandAreaCode', value)} placeholder="732" />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="step-content">
            <div className="step-intro">
              <h3>Review the launch before it goes live.</h3>
              <p>Confirm the brief, handoff paths, and number status now so the sync result is predictable.</p>
            </div>
            <ReviewStep draft={draft} />
          </div>
        )}

        <div className="wizard-footer">
          <button className="ghost-button" disabled={step === 0} onClick={() => onStepChange(step - 1)}>
            Back
          </button>
          <div className="wizard-actions">
            {step < wizardSteps.length - 1 ? (
              <button className="primary-button" onClick={() => onStepChange(step + 1)}>
                Continue
              </button>
            ) : (
              <button className="primary-button" disabled={submitting} onClick={onSubmit}>
                {submitting ? 'Submitting…' : isSettings ? 'Save settings' : editing ? 'Save and sync' : 'Create and go live'}
              </button>
            )}
          </div>
        </div>
      </section>

      <LaunchPreview draft={draft} step={step} editing={editing} mode={mode} />
    </div>
  );
}
