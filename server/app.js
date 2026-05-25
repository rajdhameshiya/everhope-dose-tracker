import cors from 'cors';
import express from 'express';
import {
  getAdherence,
  getDoseById,
  getDoseHistory,
  getPatient,
  getTodayDoses,
  initDb,
  listPatients,
  markDoseMissed,
  markDoseTaken,
  updateDoseSymptom,
} from './db.js';

initDb();

const app = express();

app.use(cors());
app.use(express.json());

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function notFound(res, message = 'Not found') {
  return res.status(404).json({ error: message });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/patients', (_req, res) => {
  res.json(listPatients());
});

app.get('/api/patients/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return notFound(res, 'Patient not found');
  const patient = getPatient(id);
  return patient ? res.json(patient) : notFound(res, 'Patient not found');
});

app.get('/api/doses/:patientId/today', (req, res) => {
  const patientId = parseId(req.params.patientId);
  if (!patientId) return notFound(res, 'Patient not found');
  res.json(getTodayDoses(patientId));
});

app.get('/api/doses/:patientId/history', (req, res) => {
  const patientId = parseId(req.params.patientId);
  if (!patientId) return notFound(res, 'Patient not found');
  const days = Number(req.query.days || 45);
  res.json(getDoseHistory(patientId, Number.isFinite(days) ? days : 45));
});

app.post('/api/doses/:doseId/taken', (req, res) => {
  const doseId = parseId(req.params.doseId);
  if (!doseId) return notFound(res, 'Dose not found');
  const dose = markDoseTaken(doseId, req.body?.takenAt || new Date().toISOString());
  return dose ? res.json(dose) : notFound(res, 'Dose not found');
});

app.post('/api/doses/:doseId/missed', (req, res) => {
  const doseId = parseId(req.params.doseId);
  if (!doseId) return notFound(res, 'Dose not found');
  const dose = markDoseMissed(doseId);
  return dose ? res.json(dose) : notFound(res, 'Dose not found');
});

app.post('/api/doses/:doseId/symptom', (req, res) => {
  const doseId = parseId(req.params.doseId);
  if (!doseId) return notFound(res, 'Dose not found');
  const note = String(req.body?.note || '').trim();
  const dose = updateDoseSymptom(doseId, note);
  return dose ? res.json(dose) : notFound(res, 'Dose not found');
});

app.get('/api/adherence/:patientId', (req, res) => {
  const patientId = parseId(req.params.patientId);
  if (!patientId) return notFound(res, 'Patient not found');
  res.json(getAdherence(patientId));
});

app.get('/api/dose/:doseId', (req, res) => {
  const doseId = parseId(req.params.doseId);
  if (!doseId) return notFound(res, 'Dose not found');
  const dose = getDoseById(doseId);
  return dose ? res.json(dose) : notFound(res, 'Dose not found');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

export default app;
