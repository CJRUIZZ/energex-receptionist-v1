const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

export const api = {
  health: () => request('/health'),
  listOrgs: () => request('/api/orgs'),
  getOrg: (orgId) => request(`/api/orgs/${orgId}`),
  submitOnboarding: (payload) =>
    request('/api/onboarding/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateOrgConfig: (orgId, payload) =>
    request(`/api/orgs/${orgId}/config`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  syncAgent: (orgId) =>
    request(`/api/agents/${orgId}/sync`, {
      method: 'POST',
    }),
  getTickets: (orgId) => request(`/api/dashboard/${orgId}/tickets`),
  getCalls: (orgId) => request(`/api/dashboard/${orgId}/calls`),
  getMetrics: (orgId) => request(`/api/dashboard/${orgId}/metrics`),
  closeTicket: (ticketId) =>
    request(`/api/dashboard/tickets/${ticketId}/close`, {
      method: 'POST',
    }),
  getCustomers: (orgId) => request(`/api/dashboard/${orgId}/customers`),
  addCustomer: (orgId, customer) =>
    request(`/api/dashboard/${orgId}/customers`, {
      method: 'POST',
      body: JSON.stringify(customer),
    }),
  updateKnowledge: (orgId, entries) =>
    request(`/api/dashboard/${orgId}/knowledge`, {
      method: 'PUT',
      body: JSON.stringify({ entries }),
    }),
};
