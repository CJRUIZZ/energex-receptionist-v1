import { startTransition, useEffect, useRef, useState } from 'react';
import OnboardingWizard from './components/OnboardingWizard.jsx';
import OperationsDashboard from './components/OperationsDashboard.jsx';
import { api } from './lib/api.js';
import { bundleToWizardState, createEmptyWizardState } from './lib/defaultState.js';

function statusText(bundle, activeView) {
  if (activeView === 'launch') return 'Launch mode';
  if (activeView === 'settings') return 'Settings mode';
  return bundle?.phoneConfig?.activation_status || bundle?.agentInstance?.sync_status || 'draft';
}

export default function App() {
  const [orgs, setOrgs] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState('');
  const [activeView, setActiveView] = useState('launch');
  const [wizardStep, setWizardStep] = useState(0);
  const [draft, setDraft] = useState(createEmptyWizardState);
  const [bundle, setBundle] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [calls, setCalls] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const autoSyncRuns = useRef(new Set());

  useEffect(() => {
    refreshOrgs();
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    loadOrg(activeOrgId);
  }, [activeOrgId]);

  useEffect(() => {
    if (activeView !== 'operations' || !activeOrgId || !bundle || syncing || submitting) return;

    const activationStatus = bundle.phoneConfig?.activation_status || 'draft';
    const syncStatus = bundle.agentInstance?.sync_status || 'draft';
    const needsSync = activationStatus !== 'live' || syncStatus !== 'live';

    if (!needsSync) return;

    const marker = bundle.agentInstance?.updated_at || bundle.phoneConfig?.updated_at || bundle.agentInstance?.last_sync_at || 'initial';
    const runKey = `${activeOrgId}:${marker}:${activationStatus}:${syncStatus}`;

    if (autoSyncRuns.current.has(runKey)) return;
    autoSyncRuns.current.add(runKey);
    handleSync();
  }, [
    activeView,
    activeOrgId,
    bundle,
    syncing,
    submitting,
  ]);

  async function refreshOrgs() {
    try {
      const data = await api.listOrgs();
      startTransition(() => {
        setOrgs(data);
        if (!activeOrgId && data[0]) {
          setActiveOrgId(data[0].id);
          setActiveView('operations');
        }
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadOrg(orgId) {
    try {
      const [orgBundle, ticketData, callData, metricData] = await Promise.all([
        api.getOrg(orgId),
        api.getTickets(orgId),
        api.getCalls(orgId),
        api.getMetrics(orgId),
      ]);

      startTransition(() => {
        setBundle(orgBundle);
        setTickets(ticketData);
        setCalls(callData);
        setMetrics(metricData);
        setDraft(bundleToWizardState(orgBundle));
      });
    } catch (err) {
      setError(err.message);
    }
  }

  function beginNewLaunch() {
    setDraft(createEmptyWizardState());
    setActiveView('launch');
    setWizardStep(0);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const result = activeView === 'settings' && activeOrgId
        ? await api.updateOrgConfig(activeOrgId, draft)
        : await api.submitOnboarding(draft);

      await refreshOrgs();
      setActiveOrgId(result.org.id);
      setActiveView('operations');
      await loadOrg(result.org.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSync() {
    if (!activeOrgId) return;
    setSyncing(true);
    setError('');
    try {
      const result = await api.syncAgent(activeOrgId);
      setBundle(result);
      await loadOrg(activeOrgId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleCloseTicket(ticketId) {
    try {
      await api.closeTicket(ticketId);
      if (activeOrgId) await loadOrg(activeOrgId);
    } catch (err) {
      setError(err.message);
    }
  }

  function showLaunchView() {
    beginNewLaunch();
  }

  function showOperationsView() {
    setActiveView('operations');
  }

  function showSettingsView() {
    if (activeOrgId && bundle) {
      setDraft(bundleToWizardState(bundle));
    }
    setActiveView('settings');
    setWizardStep(0);
  }

  const shellKpis = [
    { label: 'Calls this month', value: metrics?.counts?.callsThisMonth ?? 0 },
    { label: 'Open tickets', value: metrics?.counts?.openTickets ?? 0 },
    { label: 'Review avg', value: metrics?.averages?.reviewScore ?? '—' },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">⟲</div>
          <div className="brand-copy">
            <span>EnergeX AI</span>
            <small>Receptionist Platform</small>
          </div>
        </div>

        <div className="topbar-center">
          <button className={`nav-link ${activeView === 'launch' ? 'active' : ''}`} onClick={showLaunchView}>
            Launch
          </button>
          <button className={`nav-link ${activeView === 'settings' ? 'active' : ''}`} onClick={showSettingsView}>
            Settings
          </button>
          <button className={`nav-link ${activeView === 'operations' ? 'active' : ''}`} onClick={showOperationsView}>
            Operations
          </button>
        </div>

        <div className="topbar-actions">
          <div className="workspace-chip">
            <span className="workspace-chip-label">Workspace</span>
            <strong>{bundle?.org?.name || orgs[0]?.name || 'EnergeX Internal'}</strong>
          </div>
          <button className="primary-button compact-primary" onClick={beginNewLaunch}>
            New
          </button>
          <div className="system-pill">
            <span className="live-indicator"></span>
            {statusText(bundle, activeView)}
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="workspace-intro">
          <div>
            <p className="eyebrow">
              {activeView === 'launch' ? 'Guided setup' : activeView === 'settings' ? 'Configuration editor' : 'Live operations'}
            </p>
            <h1>
              {activeView === 'launch'
                ? 'Configure one receptionist at a time.'
                : activeView === 'settings'
                  ? 'Update the live configuration without touching Bland directly.'
                  : 'Monitor what is live and what still needs action.'}
            </h1>
            <p className="workspace-copy">
              {activeView === 'launch'
                ? 'Use a clean brief-driven workflow to shape the agent before it touches Bland or the phone layer.'
                : activeView === 'settings'
                  ? 'Business details, routing, FAQs, hours, and escalation rules all live here. Saving pushes the current source of truth back into sync.'
                  : 'Stay close to provisioning, tickets, call logs, and review scores without burying the team in dashboard noise.'}
            </p>
          </div>
          {activeView === 'operations' ? (
            <div className="shell-kpis">
              {shellKpis.map((item) => (
                <div className="shell-kpi" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {error ? <div className="error-banner">{error}</div> : null}

        {activeView === 'launch' || activeView === 'settings' ? (
          <OnboardingWizard
            step={wizardStep}
            draft={draft}
            setDraft={setDraft}
            onStepChange={setWizardStep}
            onSubmit={handleSubmit}
            submitting={submitting}
            editing={activeView === 'settings' && Boolean(activeOrgId)}
            mode={activeView}
          />
        ) : (
          <OperationsDashboard
            bundle={bundle}
            tickets={tickets}
            calls={calls}
            metrics={metrics}
            onSync={handleSync}
            syncing={syncing}
            onCloseTicket={handleCloseTicket}
          />
        )}
      </main>
    </div>
  );
}
