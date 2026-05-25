const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3002');

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  patients: () => request('/api/patients'),
  patient: (id) => request(`/api/patients/${id}`),
  todayDoses: (patientId) => request(`/api/doses/${patientId}/today`),
  history: (patientId, days = 45) => request(`/api/doses/${patientId}/history?days=${days}`),
  adherence: (patientId) => request(`/api/adherence/${patientId}`),
  dose: (doseId) => request(`/api/dose/${doseId}`),
  markTaken: (doseId, takenAt) => request(`/api/doses/${doseId}/taken`, {
    method: 'POST',
    body: JSON.stringify({ takenAt }),
  }),
  markMissed: (doseId) => request(`/api/doses/${doseId}/missed`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  symptom: (doseId, note) => request(`/api/doses/${doseId}/symptom`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  }),
};
