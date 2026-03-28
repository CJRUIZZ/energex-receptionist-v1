import { useState } from 'react';
import { badgeClass, fmtDate, fmtDuration, reviewScore, reviewSummary } from '../lib/format.js';

function esc(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Sub-tabs ────────────────────────────────────────────────────────── */

function TabBar({ active, onChange, tabs }) {
  return (
    <div className="dash-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`dash-tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count != null ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ── Overview ────────────────────────────────────────────────────────── */

function OverviewTab({ bundle, metrics, onSync, syncing }) {
  const status = bundle?.phoneConfig?.activation_status || bundle?.agentInstance?.sync_status || 'draft';

  const metricCards = [
    { label: 'Calls this week', value: metrics?.counts?.callsThisWeek ?? 0 },
    { label: 'Calls this month', value: metrics?.counts?.callsThisMonth ?? 0 },
    { label: 'Escalation rate', value: `${metrics?.averages?.escalationRate ?? 0}%` },
    { label: 'Avg review score', value: metrics?.averages?.reviewScore ?? '—' },
  ];

  return (
    <div className="stack gap-lg">
      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">Status</p>
            <h2>{esc(bundle?.org?.name) || 'Receptionist'}</h2>
            <p className="section-description">Agent health, phone number, and sync status.</p>
          </div>
          <button className="primary-button" onClick={onSync} disabled={!bundle?.org || syncing}>
            {syncing ? 'Syncing…' : 'Retry sync'}
          </button>
        </div>
        <div className="ops-summary-grid">
          <div className="ops-summary-card">
            <span className={`status-badge ${status}`}>{status}</span>
            <p>Bland number</p>
            <strong>{bundle?.phoneConfig?.bland_number || bundle?.agentInstance?.bland_phone_number || 'Pending'}</strong>
          </div>
          <div className="ops-summary-card">
            <p>Existing number</p>
            <strong>{bundle?.phoneConfig?.existing_number || 'Not provided'}</strong>
            <small>Twilio: {bundle?.phoneConfig?.twilio_phone_sid ? 'Configured' : 'Needs action'}</small>
          </div>
          <div className="ops-summary-card">
            <p>Last sync</p>
            <strong>{fmtDate(bundle?.agentInstance?.last_sync_at)}</strong>
            <small>{bundle?.agentInstance?.bland_webhook_url || 'Webhook pending'}</small>
          </div>
          <div className="ops-summary-card">
            <p>Next action</p>
            <strong>{bundle?.phoneConfig?.activation_notes || bundle?.agentInstance?.last_error || 'Ready'}</strong>
          </div>
        </div>
      </section>

      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">Performance</p>
            <h2>Key metrics</h2>
          </div>
        </div>
        <div className="kpis">
          {metricCards.map((card) => (
            <div key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Tickets ─────────────────────────────────────────────────────────── */

function TicketsTab({ tickets, onClose }) {
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const filtered = filter === 'all'
    ? tickets
    : tickets.filter((t) => t.status === filter);

  const visible = showAll ? filtered : filtered.slice(0, 15);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const closedCount = tickets.filter((t) => t.status === 'closed').length;
  const highCount = tickets.filter((t) => t.urgency?.toLowerCase() === 'high' && t.status === 'open').length;

  return (
    <section className="surface">
      <div className="section-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Support tickets</h2>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card"><strong>{tickets.length}</strong><span>Total</span></div>
        <div className="stat-card"><strong>{openCount}</strong><span>Open</span></div>
        <div className="stat-card"><strong>{closedCount}</strong><span>Closed</span></div>
        <div className="stat-card"><strong>{highCount}</strong><span>High urgency</span></div>
      </div>

      <div className="filter-bar">
        {[
          { id: 'all', label: 'All', count: tickets.length },
          { id: 'open', label: 'Open', count: openCount },
          { id: 'closed', label: 'Closed', count: closedCount },
        ].map((f) => (
          <button
            key={f.id}
            className={`filter-btn ${filter === f.id ? 'active' : ''}`}
            onClick={() => { setFilter(f.id); setShowAll(false); }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">No tickets to show{filter !== 'all' ? ` with status "${filter}"` : ''}.</div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Caller</th>
                <th>Summary</th>
                <th>Urgency</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{fmtDate(ticket.created_at)}</td>
                  <td>{esc(ticket.caller_phone) || 'Unknown'}</td>
                  <td>{esc(ticket.summary)}</td>
                  <td><span className={`status-pill ${(ticket.urgency || '').toLowerCase()}`}>{esc(ticket.urgency)}</span></td>
                  <td><span className={`status-pill ${ticket.status}`}>{ticket.status}</span></td>
                  <td>
                    {ticket.status === 'open'
                      ? <button className="ghost-button compact" onClick={() => onClose(ticket.id)}>Close</button>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!showAll && filtered.length > 15 ? (
        <button className="ghost-button" onClick={() => setShowAll(true)}>
          Show all {filtered.length} tickets
        </button>
      ) : null}
    </section>
  );
}

/* ── Calls ───────────────────────────────────────────────────────────── */

function CallsTab({ calls, reviews }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? calls : calls.slice(0, 15);
  const visibleReviews = (reviews || []).slice(0, 6);

  return (
    <div className="stack gap-lg">
      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">History</p>
            <h2>Call log</h2>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">No calls recorded yet. Once the receptionist takes its first call, it'll show up here.</div>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Review</th>
                  <th>Transcript</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((call) => {
                  const score = reviewScore(call.bland_review);
                  return (
                    <tr key={call.id}>
                      <td>{fmtDate(call.created_at)}</td>
                      <td>{fmtDuration(call.duration_seconds)}</td>
                      <td><span className={`review-pill ${badgeClass(score)}`}>{score ?? '—'}</span></td>
                      <td className="transcript-cell">{esc(call.transcript || reviewSummary(call.bland_review))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!showAll && calls.length > 15 ? (
          <button className="ghost-button" onClick={() => setShowAll(true)}>
            Show all {calls.length} calls
          </button>
        ) : null}
      </section>

      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">Quality</p>
            <h2>Recent reviews</h2>
          </div>
        </div>
        {visibleReviews.length === 0 ? (
          <div className="empty-state">No review scores yet. Bland scores each call automatically after it ends.</div>
        ) : (
          <div className="review-strip dense">
            {visibleReviews.map((review) => {
              const score = reviewScore(review.review);
              return (
                <div className="review-card" key={review.id}>
                  <span className={`review-pill ${badgeClass(score)}`}>{score ?? '—'}</span>
                  <p>{esc(reviewSummary(review.review))}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Customers ───────────────────────────────────────────────────────── */

function CustomersTab({ customers, onAddCustomer }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', appointment_date: '', appointment_type: '', notes: '' });

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (!form.name || !form.phone) return;
    onAddCustomer(form);
    setForm({ name: '', phone: '', appointment_date: '', appointment_type: '', notes: '' });
    setShowForm(false);
  }

  return (
    <section className="surface">
      <div className="section-header">
        <div>
          <p className="eyebrow">Records</p>
          <h2>Customer database</h2>
          <p className="section-description">Customers stored here can be looked up by the AI during live calls — for example, to confirm an appointment.</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add customer'}
        </button>
      </div>

      {showForm ? (
        <div className="inline-form">
          <div className="form-row">
            <input type="text" placeholder="Full name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
            <input type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
          </div>
          <div className="form-row">
            <input type="datetime-local" value={form.appointment_date} onChange={(e) => handleChange('appointment_date', e.target.value)} />
            <input type="text" placeholder="Appointment type (e.g. Cleaning)" value={form.appointment_type} onChange={(e) => handleChange('appointment_type', e.target.value)} />
          </div>
          <input type="text" placeholder="Notes (optional)" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
          <button className="primary-button" onClick={handleSubmit}>Save customer</button>
        </div>
      ) : null}

      {customers.length === 0 ? (
        <div className="empty-state">No customers added yet. Add a customer record and the AI receptionist will be able to look them up during a call.</div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Next appointment</th>
                <th>Type</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{esc(c.name)}</td>
                  <td>{esc(c.phone)}</td>
                  <td>{c.appointment_date ? fmtDate(c.appointment_date) : '—'}</td>
                  <td>{esc(c.appointment_type) || '—'}</td>
                  <td>{esc(c.notes) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── Knowledge Base ──────────────────────────────────────────────────── */

function KnowledgeTab({ entries, onSave }) {
  const [localEntries, setLocalEntries] = useState(entries || []);
  const [dirty, setDirty] = useState(false);

  function updateEntry(index, field, value) {
    setLocalEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
  }

  function addEntry() {
    setLocalEntries((prev) => [...prev, { question: '', answer: '', category: 'General' }]);
    setDirty(true);
  }

  function removeEntry(index) {
    setLocalEntries((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  function handleSave() {
    onSave(localEntries);
    setDirty(false);
  }

  return (
    <section className="surface">
      <div className="section-header">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2>Knowledge base</h2>
          <p className="section-description">Add questions callers commonly ask. The AI receptionist uses these to answer without escalating.</p>
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={addEntry}>Add entry</button>
          {dirty ? <button className="primary-button" onClick={handleSave}>Save changes</button> : null}
        </div>
      </div>

      {localEntries.length === 0 ? (
        <div className="empty-state">No FAQ entries yet. Add common questions and answers so the AI can handle them automatically.</div>
      ) : (
        <div className="kb-entries">
          {localEntries.map((entry, i) => (
            <div className="kb-entry" key={i}>
              <div className="kb-entry-header">
                <select value={entry.category || 'General'} onChange={(e) => updateEntry(i, 'category', e.target.value)}>
                  <option>General</option>
                  <option>Hours</option>
                  <option>Pricing</option>
                  <option>Services</option>
                  <option>Policies</option>
                  <option>Location</option>
                </select>
                <button className="ghost-button compact danger" onClick={() => removeEntry(i)}>Remove</button>
              </div>
              <input
                type="text"
                placeholder="Question (e.g. What are your hours?)"
                value={entry.question || ''}
                onChange={(e) => updateEntry(i, 'question', e.target.value)}
              />
              <textarea
                placeholder="Answer"
                rows={2}
                value={entry.answer || ''}
                onChange={(e) => updateEntry(i, 'answer', e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────────────── */

export default function OperationsDashboard({
  bundle,
  tickets,
  calls,
  metrics,
  customers,
  knowledgeEntries,
  onSync,
  syncing,
  onCloseTicket,
  onAddCustomer,
  onSaveKnowledge,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!bundle?.org) {
    return (
      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>No receptionist selected</h2>
            <p className="section-description">Create a new agent or select an existing workspace to get started.</p>
          </div>
        </div>
        <div className="empty-state">Set up your first AI receptionist using the "New Agent" button above.</div>
      </section>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'tickets', label: 'Tickets', count: tickets.filter((t) => t.status === 'open').length },
    { id: 'calls', label: 'Calls', count: calls.length },
    { id: 'customers', label: 'Customers', count: customers.length },
    { id: 'knowledge', label: 'Knowledge Base', count: knowledgeEntries.length },
  ];

  return (
    <div className="stack gap-lg">
      <TabBar active={activeTab} onChange={setActiveTab} tabs={tabs} />

      {activeTab === 'overview' && (
        <OverviewTab bundle={bundle} metrics={metrics} onSync={onSync} syncing={syncing} />
      )}
      {activeTab === 'tickets' && (
        <TicketsTab tickets={tickets} onClose={onCloseTicket} />
      )}
      {activeTab === 'calls' && (
        <CallsTab calls={calls} reviews={metrics?.recentReviews || []} />
      )}
      {activeTab === 'customers' && (
        <CustomersTab customers={customers} onAddCustomer={onAddCustomer} />
      )}
      {activeTab === 'knowledge' && (
        <KnowledgeTab entries={knowledgeEntries} onSave={onSaveKnowledge} />
      )}
    </div>
  );
}
