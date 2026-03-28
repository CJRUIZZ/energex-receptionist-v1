import { badgeClass, fmtDate, fmtDuration, reviewScore, reviewSummary } from '../lib/format.js';

function ProvisioningCard({ bundle, onSync, syncing }) {
  const status = bundle?.phoneConfig?.activation_status || bundle?.agentInstance?.sync_status || 'draft';
  return (
    <section className="surface">
      <div className="section-header">
        <div>
          <p className="eyebrow">Provisioning</p>
          <h2>{bundle?.org?.name || 'Receptionist not loaded'}</h2>
          <p className="section-description">Track launch health, number readiness, and the next operational action. Sync runs automatically when this workspace needs it.</p>
        </div>
        <button className="primary-button" onClick={onSync} disabled={!bundle?.org || syncing}>
          {syncing ? 'Syncing…' : 'Retry sync'}
        </button>
      </div>

      {!bundle?.org ? (
        <div className="empty-state">Create a receptionist or reopen an existing workspace to view provisioning status.</div>
      ) : (
        <div className="ops-summary-grid">
          <div className="ops-summary-card">
            <span className={`status-badge ${status}`}>{status}</span>
            <p>Bland number</p>
            <strong>{bundle.phoneConfig?.bland_number || bundle.agentInstance?.bland_phone_number || 'Pending'}</strong>
          </div>
          <div className="ops-summary-card">
            <p>Existing number</p>
            <strong>{bundle.phoneConfig?.existing_number || 'Not provided'}</strong>
            <small>Twilio: {bundle.phoneConfig?.twilio_phone_sid ? 'Configured' : 'Needs action'}</small>
          </div>
          <div className="ops-summary-card">
            <p>Last sync</p>
            <strong>{fmtDate(bundle.agentInstance?.last_sync_at)}</strong>
            <small>{bundle.agentInstance?.bland_webhook_url || 'Webhook pending'}</small>
          </div>
          <div className="ops-summary-card">
            <p>Next action</p>
            <strong>{bundle.phoneConfig?.activation_notes || bundle.agentInstance?.last_error || 'Ready'}</strong>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricsSection({ metrics }) {
  const cards = [
    { label: 'Calls this week', value: metrics?.counts?.callsThisWeek ?? 0 },
    { label: 'Calls this month', value: metrics?.counts?.callsThisMonth ?? 0 },
    { label: 'Escalation rate', value: `${metrics?.averages?.escalationRate ?? 0}%` },
    { label: 'Avg review', value: metrics?.averages?.reviewScore ?? '—' },
  ];

  return (
    <section className="surface">
      <div className="section-header">
        <div>
          <p className="eyebrow">Metrics</p>
          <h2>Operational pulse</h2>
        </div>
      </div>
      <div className="kpis">
        {cards.map((card) => (
          <div key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function TicketsSection({ tickets, onClose }) {
  const visible = tickets.slice(0, 8);

  return (
    <section className="surface">
      <div className="section-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Recent tickets</h2>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">No tickets yet.</div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Caller</th>
                <th>Summary</th>
                <th>Urgency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{fmtDate(ticket.created_at)}</td>
                  <td>{ticket.caller_phone || 'Unknown'}</td>
                  <td>{ticket.summary}</td>
                  <td><span className={`status-pill ${ticket.urgency.toLowerCase()}`}>{ticket.urgency}</span></td>
                  <td>{ticket.status === 'open' ? <button className="ghost-button compact" onClick={() => onClose(ticket.id)}>Close</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CallsSection({ calls, reviews }) {
  const visibleCalls = calls.slice(0, 8);
  const visibleReviews = (reviews || []).slice(0, 4);

  return (
    <div className="ops-two-col">
      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">Calls</p>
            <h2>Recent calls</h2>
          </div>
        </div>
        {visibleCalls.length === 0 ? (
          <div className="empty-state">No calls logged yet.</div>
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
                {visibleCalls.map((call) => {
                  const score = reviewScore(call.bland_review);
                  return (
                    <tr key={call.id}>
                      <td>{fmtDate(call.created_at)}</td>
                      <td>{fmtDuration(call.duration_seconds)}</td>
                      <td><span className={`review-pill ${badgeClass(score)}`}>{score ?? '—'}</span></td>
                      <td className="transcript-cell">{call.transcript || reviewSummary(call.bland_review)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">Reviews</p>
            <h2>Bland quality signals</h2>
          </div>
        </div>
        {visibleReviews.length === 0 ? (
          <div className="empty-state">No review scores yet.</div>
        ) : (
          <div className="review-strip dense">
            {visibleReviews.map((review) => {
              const score = reviewScore(review.review);
              return (
                <div className="review-card" key={review.id}>
                  <span className={`review-pill ${badgeClass(score)}`}>{score ?? '—'}</span>
                  <p>{reviewSummary(review.review)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function OperationsDashboard({ bundle, tickets, calls, metrics, onSync, syncing, onCloseTicket }) {
  if (!bundle?.org) {
    return (
      <section className="surface">
        <div className="section-header">
          <div>
            <p className="eyebrow">Operations</p>
            <h2>No live receptionist selected</h2>
            <p className="section-description">Create a new launch first, or open an existing receptionist to view provisioning, tickets, calls, and review scores.</p>
          </div>
        </div>
        <div className="empty-state">There is no live organization loaded into the operations console yet.</div>
      </section>
    );
  }

  return (
    <div className="stack gap-lg">
      <ProvisioningCard bundle={bundle} onSync={onSync} syncing={syncing} />
      <MetricsSection metrics={metrics} />
      <TicketsSection tickets={tickets} onClose={onCloseTicket} />
      <CallsSection calls={calls} reviews={metrics?.recentReviews || []} />
    </div>
  );
}
