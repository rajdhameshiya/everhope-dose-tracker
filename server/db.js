import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'everhope.sqlite'));

db.pragma('journal_mode = WAL');

export const PRODUCTS = [
  {
    id: 1,
    name: 'Immune Support Bundle',
    short_desc: 'Curcumin · Vitamin D3 · Zinc',
    full_desc: 'Supports immune function and reduces inflammation during active treatment.',
    dosage: '2 capsules',
    times: ['08:00', '20:00'],
    instruction: 'Take with food. Avoid on empty stomach.',
    why_it_helps: 'Curcumin reduces treatment-related inflammation. Zinc supports white blood cell recovery.',
    capsules_per_pack: 60,
  },
  {
    id: 2,
    name: 'Gut Health Protocol',
    short_desc: 'Probiotic blend · Glutamine',
    full_desc: 'Restores gut lining and microbiome balance disrupted by chemotherapy.',
    dosage: '1 sachet',
    times: ['07:00'],
    instruction: 'Mix in lukewarm water. Take 30 minutes before breakfast.',
    why_it_helps: 'Chemo damages the gut lining. Glutamine helps repair it. Probiotics restore healthy bacteria.',
    capsules_per_pack: 30,
  },
  {
    id: 3,
    name: 'Energy & Strength Pack',
    short_desc: 'Iron · B12 · CoQ10',
    full_desc: 'Combats treatment-related fatigue and supports red blood cell production.',
    dosage: '1 tablet',
    times: ['09:00'],
    instruction: 'Take with orange juice for better iron absorption. Avoid tea or coffee within 1 hour.',
    why_it_helps: 'Chemo-related anaemia causes fatigue. Iron and B12 support red blood cell recovery. CoQ10 supports cellular energy.',
    capsules_per_pack: 30,
  },
  {
    id: 4,
    name: 'Bone Health Formula',
    short_desc: 'Calcium · Vitamin K2 · Magnesium',
    full_desc: 'Protects bone density during hormone therapy and post-surgical recovery.',
    dosage: '2 tablets',
    times: ['08:00', '21:00'],
    instruction: 'Take with meals. Do not take within 2 hours of iron supplements.',
    why_it_helps: 'Hormone therapy accelerates bone density loss. This formula actively slows that process.',
    capsules_per_pack: 60,
  },
  {
    id: 5,
    name: 'Anti-Nausea Support',
    short_desc: 'Ginger extract · B6 · Peppermint',
    full_desc: 'Manages chemotherapy-induced nausea naturally and safely.',
    dosage: '1 capsule',
    times: ['08:00', '13:00', '19:00'],
    instruction: 'Take 30 minutes before meals. Can be taken on empty stomach.',
    why_it_helps: 'Ginger extract has strong clinical evidence for chemo-induced nausea. B6 reduces nausea signals in the brain.',
    capsules_per_pack: 90,
  }
];

export const PATIENTS = [
  {
    id: 1,
    name: 'Priya',
    full_name: 'Priya Sharma',
    age: 44,
    cancer_type: 'Breast Cancer',
    treatment_phase: 'Active Chemotherapy',
    assigned_products: [1, 2, 3],
    start_date: '2026-04-01',
    avatar_initials: 'PS',
    avatar_color: '#0F6E56',
    streak_goal: 7,
  },
  {
    id: 2,
    name: 'Arun',
    full_name: 'Arun Mehta',
    age: 61,
    cancer_type: 'Colorectal Cancer',
    treatment_phase: 'Post-Surgery Recovery',
    assigned_products: [1, 4],
    start_date: '2026-04-15',
    avatar_initials: 'AM',
    avatar_color: '#185FA5',
    streak_goal: 7,
  },
  {
    id: 3,
    name: 'Kavitha',
    full_name: 'Kavitha Nair',
    age: 52,
    cancer_type: 'Ovarian Cancer',
    treatment_phase: 'Hormone Therapy',
    assigned_products: [3, 4, 5],
    start_date: '2026-04-01',
    avatar_initials: 'KN',
    avatar_color: '#7C3AED',
    streak_goal: 7,
  }
];

const SYMPTOM_NOTES = [
  'slight nausea after dose',
  'no issues today',
  'felt bloated for an hour',
  'energy felt better this morning',
  'mild stomach cramp',
  'slept well last night',
  'no side effects',
  'a bit tired today',
  'felt stronger than yesterday',
];

const HISTORY_DAYS = 45;
const TIME_ZONE = 'Asia/Kolkata';
const SEED_VERSION = '2';
const MISS_RATES = {
  1: 0.18,
  2: 0.09,
  3: 0.32,
};

function hashNumber(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUnit(...parts) {
  return hashNumber(parts.join('|')) / 4294967295;
}

function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function getTodayKey() {
  return process.env.EVERHOPE_TODAY || dateKey(new Date());
}

function addDays(key, offset) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function minutesFromTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function currentLocalMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(byType.hour) * 60 + Number(byType.minute);
}

function takenAtForSlot(date, time, patientId, productId) {
  const delay = Math.floor(hashUnit('delay', date, time, patientId, productId) * 26);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const istOffsetMinutes = 330;
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute + delay - istOffsetMinutes);
  return new Date(utcMillis).toISOString();
}

function missScore(patientId, slot) {
  let score = hashUnit('miss', patientId, slot.productId, slot.date, slot.time);
  const distance = Math.abs(slot.offset);

  if (patientId === 1) {
    if (slot.offset >= -4) score -= 1.2;
    if (slot.time === '20:00') score += 0.65;
    if (slot.productId === 1 && slot.time === '08:00') score += 0.12;
    if (distance % 11 === 0) score += 0.18;
  }

  if (patientId === 2) {
    if (slot.offset >= -7) score -= 1.2;
    if (slot.time === '21:00' || slot.time === '20:00') score += 0.34;
    if (distance % 17 === 0) score += 0.2;
  }

  if (patientId === 3) {
    if (distance % 10 === 1) score += 1.4;
    if (slot.time === '13:00') score += 0.85;
    if (slot.time === '19:00' || slot.time === '21:00') score += 0.28;
    if (slot.productId === 5) score += 0.16;
  }

  return score;
}

function markMisses(slots, patientId) {
  const misses = Math.round(slots.length * MISS_RATES[patientId]);
  const ranked = [...slots].sort((a, b) => {
    const scoreDiff = missScore(patientId, b) - missScore(patientId, a);
    if (scoreDiff !== 0) return scoreDiff;
    return hashNumber(`${a.date}|${a.productId}|${a.time}`) - hashNumber(`${b.date}|${b.productId}|${b.time}`);
  });
  const missedKeys = new Set(ranked.slice(0, misses).map((slot) => slot.key));
  for (const slot of slots) {
    slot.status = missedKeys.has(slot.key) ? 'missed' : 'taken';
  }
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      cancer_type TEXT NOT NULL,
      treatment_phase TEXT NOT NULL,
      start_date TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      streak_goal INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      short_desc TEXT NOT NULL,
      full_desc TEXT NOT NULL,
      dosage TEXT NOT NULL,
      instruction TEXT NOT NULL,
      why_it_helps TEXT NOT NULL,
      capsules_per_pack INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_times (
      product_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      PRIMARY KEY (product_id, time),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS patient_products (
      patient_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      PRIMARY KEY (patient_id, product_id),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS doses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      dose_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'taken', 'missed')),
      taken_at TEXT,
      symptom_note TEXT,
      UNIQUE (patient_id, product_id, dose_date, scheduled_time),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_doses_patient_date ON doses(patient_id, dose_date);
    CREATE INDEX IF NOT EXISTS idx_doses_patient_product ON doses(patient_id, product_id);
  `);
}

function seedDatabase() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM patients').get();
  const version = db.prepare('SELECT value FROM app_meta WHERE key = ?').get('seed_version');
  if (existing.count > 0 && version?.value === SEED_VERSION) return;

  if (existing.count > 0) {
    db.exec(`
      DELETE FROM doses;
      DELETE FROM patient_products;
      DELETE FROM product_times;
      DELETE FROM products;
      DELETE FROM patients;
    `);
  }

  const insertPatient = db.prepare(`
    INSERT INTO patients (
      id, name, full_name, age, cancer_type, treatment_phase, start_date,
      avatar_initials, avatar_color, streak_goal
    ) VALUES (
      @id, @name, @full_name, @age, @cancer_type, @treatment_phase, @start_date,
      @avatar_initials, @avatar_color, @streak_goal
    )
  `);

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, name, short_desc, full_desc, dosage, instruction, why_it_helps, capsules_per_pack
    ) VALUES (
      @id, @name, @short_desc, @full_desc, @dosage, @instruction, @why_it_helps, @capsules_per_pack
    )
  `);

  const insertProductTime = db.prepare('INSERT INTO product_times (product_id, time) VALUES (?, ?)');
  const insertPatientProduct = db.prepare('INSERT INTO patient_products (patient_id, product_id) VALUES (?, ?)');
  const insertDose = db.prepare(`
    INSERT INTO doses (
      patient_id, product_id, dose_date, scheduled_time, status, taken_at, symptom_note
    ) VALUES (
      @patientId, @productId, @date, @time, @status, @takenAt, @symptomNote
    )
  `);

  const transaction = db.transaction(() => {
    for (const product of PRODUCTS) {
      insertProduct.run(product);
      for (const time of product.times) insertProductTime.run(product.id, time);
    }

    for (const patient of PATIENTS) {
      insertPatient.run(patient);
      for (const productId of patient.assigned_products) insertPatientProduct.run(patient.id, productId);
    }

    const today = getTodayKey();

    for (const patient of PATIENTS) {
      const assignedProducts = PRODUCTS.filter((product) => patient.assigned_products.includes(product.id));
      const pastSlots = [];

      for (let offset = -(HISTORY_DAYS - 1); offset <= -1; offset += 1) {
        const date = addDays(today, offset);
        for (const product of assignedProducts) {
          for (const time of product.times) {
            pastSlots.push({
              key: `${patient.id}|${product.id}|${date}|${time}`,
              patientId: patient.id,
              productId: product.id,
              date,
              time,
              offset,
              status: 'taken',
            });
          }
        }
      }

      markMisses(pastSlots.filter((slot) => slot.offset >= -30), patient.id);
      markMisses(pastSlots.filter((slot) => slot.offset < -30), patient.id);

      for (const slot of pastSlots) {
        const takenAt = slot.status === 'taken'
          ? takenAtForSlot(slot.date, slot.time, patient.id, slot.productId)
          : null;
        const shouldLogSymptom = slot.status === 'taken'
          && hashNumber(`note|${slot.key}`) % 5 === 0;
        const noteIndex = hashNumber(`note-index|${slot.key}`) % SYMPTOM_NOTES.length;

        insertDose.run({
          ...slot,
          takenAt,
          symptomNote: shouldLogSymptom ? SYMPTOM_NOTES[noteIndex] : null,
        });
      }

      for (const product of assignedProducts) {
      for (const time of product.times) {
          insertDose.run({
            patientId: patient.id,
            productId: product.id,
            date: today,
            time,
            status: 'pending',
            takenAt: null,
            symptomNote: null,
          });
        }
      }
    }

    db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run('seed_version', SEED_VERSION);
  });

  transaction();
}

function serializeProduct(row) {
  const times = db.prepare('SELECT time FROM product_times WHERE product_id = ? ORDER BY time').all(row.id);
  return {
    id: row.id,
    name: row.name,
    short_desc: row.short_desc,
    full_desc: row.full_desc,
    dosage: row.dosage,
    instruction: row.instruction,
    why_it_helps: row.why_it_helps,
    capsules_per_pack: row.capsules_per_pack,
    times: times.map((item) => item.time),
  };
}

function serializePatient(row) {
  const assigned = db.prepare('SELECT product_id FROM patient_products WHERE patient_id = ? ORDER BY product_id').all(row.id);
  return {
    id: row.id,
    name: row.name,
    full_name: row.full_name,
    age: row.age,
    cancer_type: row.cancer_type,
    treatment_phase: row.treatment_phase,
    assigned_products: assigned.map((item) => item.product_id),
    start_date: row.start_date,
    avatar_initials: row.avatar_initials,
    avatar_color: row.avatar_color,
    streak_goal: row.streak_goal,
  };
}

function doseRows(patientId, clause = '', params = []) {
  return db.prepare(`
    SELECT
      d.id,
      d.patient_id,
      d.product_id,
      d.dose_date,
      d.scheduled_time,
      d.status,
      d.taken_at,
      d.symptom_note,
      p.name AS product_name,
      p.short_desc,
      p.full_desc,
      p.dosage,
      p.instruction,
      p.why_it_helps,
      p.capsules_per_pack
    FROM doses d
    JOIN products p ON p.id = d.product_id
    WHERE d.patient_id = ?
    ${clause}
    ORDER BY d.dose_date, d.scheduled_time, d.product_id
  `).all(patientId, ...params);
}

function serializeDose(row) {
  return {
    id: row.id,
    patient_id: row.patient_id,
    product_id: row.product_id,
    dose_date: row.dose_date,
    scheduled_time: row.scheduled_time,
    status: row.status,
    taken_at: row.taken_at,
    symptom_note: row.symptom_note,
    product: {
      id: row.product_id,
      name: row.product_name,
      short_desc: row.short_desc,
      full_desc: row.full_desc,
      dosage: row.dosage,
      instruction: row.instruction,
      why_it_helps: row.why_it_helps,
      capsules_per_pack: row.capsules_per_pack,
    },
  };
}

function percent(taken, total) {
  if (!total) return 0;
  return Math.round((taken / total) * 100);
}

function dayStats(rows) {
  const stats = new Map();
  for (const row of rows) {
    const existing = stats.get(row.dose_date) || {
      date: row.dose_date,
      total: 0,
      taken: 0,
      missed: 0,
      pending: 0,
    };
    existing.total += 1;
    existing[row.status] += 1;
    stats.set(row.dose_date, existing);
  }
  return stats;
}

function dailyAdherence(stats) {
  const completed = stats.taken + stats.missed;
  if (!completed) return null;
  return percent(stats.taken, completed);
}

function dayQualifiesForStreak(stats, isToday) {
  if (!stats || !stats.total) return false;
  const ratio = stats.taken / stats.total;

  if (isToday) {
    if (stats.pending > 0 && ratio < 0.8) return null;
    return ratio >= 0.8;
  }

  return ratio >= 0.8;
}

function currentStreak(rows, today) {
  const stats = dayStats(rows);
  const start = addDays(today, -(HISTORY_DAYS - 1));
  let streak = 0;

  for (let cursor = today; cursor >= start; cursor = addDays(cursor, -1)) {
    const qualifies = dayQualifiesForStreak(stats.get(cursor), cursor === today);
    if (qualifies === null) continue;
    if (!qualifies) break;
    streak += 1;
  }

  return streak;
}

function personalBestStreak(rows, today) {
  const stats = dayStats(rows);
  const start = addDays(today, -(HISTORY_DAYS - 1));
  let best = 0;
  let current = 0;

  for (let cursor = start; cursor <= today; cursor = addDays(cursor, 1)) {
    const qualifies = dayQualifiesForStreak(stats.get(cursor), cursor === today);
    if (qualifies) {
      current += 1;
      best = Math.max(best, current);
    } else if (qualifies !== null) {
      current = 0;
    }
  }

  return best;
}

function adherenceForRange(rows, start, end) {
  let taken = 0;
  let completed = 0;
  for (const row of rows) {
    if (row.dose_date < start || row.dose_date > end) continue;
    if (row.status === 'taken') {
      taken += 1;
      completed += 1;
    }
    if (row.status === 'missed') completed += 1;
  }
  return percent(taken, completed);
}

function refillPredictions(patientId) {
  const products = getProductsForPatient(patientId);
  const takenCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM doses
    WHERE patient_id = ? AND product_id = ? AND status = 'taken'
  `);

  return products.map((product) => {
    const dosesTaken = takenCount.get(patientId, product.id).count;
    const dosesRemaining = product.capsules_per_pack - dosesTaken;
    const dailyDoseCount = product.times.length;
    const daysRemaining = Math.floor(dosesRemaining / dailyDoseCount);
    return {
      productId: product.id,
      productName: product.name,
      dosesTaken,
      dosesRemaining,
      dailyDoseCount,
      daysRemaining,
      fullnessPercent: Math.max(0, Math.min(100, Math.round((Math.max(0, dosesRemaining) / product.capsules_per_pack) * 100))),
    };
  });
}

function consecutiveMissNudge(patientId) {
  const rows = db.prepare(`
    SELECT d.product_id, d.status, d.dose_date, d.scheduled_time, p.name AS product_name
    FROM doses d
    JOIN products p ON p.id = d.product_id
    WHERE d.patient_id = ? AND d.status IN ('taken', 'missed')
    ORDER BY d.dose_date DESC, d.scheduled_time DESC
  `).all(patientId);

  const byProduct = new Map();
  for (const row of rows) {
    const list = byProduct.get(row.product_id) || [];
    if (list.length < 3) list.push(row);
    byProduct.set(row.product_id, list);
  }

  for (const [productId, list] of byProduct.entries()) {
    if (list.length === 3 && list.every((row) => row.status === 'missed')) {
      return {
        productId,
        productName: list[0].product_name,
        message: `${list[0].product_name} has been missed a few times. A small reset today can help you get back into rhythm.`,
      };
    }
  }

  return null;
}

function recentNotes(patientId) {
  return db.prepare(`
    SELECT d.symptom_note AS note, d.taken_at, p.name AS product_name
    FROM doses d
    JOIN products p ON p.id = d.product_id
    WHERE d.patient_id = ? AND d.symptom_note IS NOT NULL AND d.symptom_note != ''
    ORDER BY d.dose_date DESC, d.scheduled_time DESC
    LIMIT 8
  `).all(patientId);
}

export function initDb() {
  createSchema();
  seedDatabase();
}

export function listPatients() {
  return db.prepare('SELECT * FROM patients ORDER BY id').all().map(serializePatient);
}

export function getProductsForPatient(patientId) {
  const rows = db.prepare(`
    SELECT p.*
    FROM products p
    JOIN patient_products pp ON pp.product_id = p.id
    WHERE pp.patient_id = ?
    ORDER BY p.id
  `).all(patientId);
  return rows.map(serializeProduct);
}

export function getPatient(patientId) {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);
  if (!row) return null;
  return {
    ...serializePatient(row),
    products: getProductsForPatient(patientId),
  };
}

export function getTodayDoses(patientId) {
  const today = getTodayKey();
  return doseRows(patientId, 'AND d.dose_date = ?', [today]).map(serializeDose);
}

export function getDoseHistory(patientId, days = HISTORY_DAYS) {
  const today = getTodayKey();
  const start = addDays(today, -(days - 1));
  return doseRows(patientId, 'AND d.dose_date >= ? AND d.dose_date <= ?', [start, today]).map(serializeDose);
}

export function getDoseById(doseId) {
  const row = db.prepare(`
    SELECT
      d.id,
      d.patient_id,
      d.product_id,
      d.dose_date,
      d.scheduled_time,
      d.status,
      d.taken_at,
      d.symptom_note,
      p.name AS product_name,
      p.short_desc,
      p.full_desc,
      p.dosage,
      p.instruction,
      p.why_it_helps,
      p.capsules_per_pack
    FROM doses d
    JOIN products p ON p.id = d.product_id
    WHERE d.id = ?
  `).get(doseId);
  return row ? serializeDose(row) : null;
}

export function markDoseTaken(doseId, takenAt = new Date().toISOString()) {
  db.prepare(`
    UPDATE doses
    SET status = 'taken', taken_at = ?
    WHERE id = ?
  `).run(takenAt, doseId);
  return getDoseById(doseId);
}

export function markDoseMissed(doseId) {
  db.prepare(`
    UPDATE doses
    SET status = 'missed', taken_at = NULL, symptom_note = NULL
    WHERE id = ?
  `).run(doseId);
  return getDoseById(doseId);
}

export function updateDoseSymptom(doseId, note) {
  db.prepare(`
    UPDATE doses
    SET symptom_note = ?
    WHERE id = ?
  `).run(note, doseId);
  return getDoseById(doseId);
}

export function getAdherence(patientId) {
  const today = getTodayKey();
  const yesterday = addDays(today, -1);
  const start30 = addDays(today, -30);
  const startHistory = addDays(today, -(HISTORY_DAYS - 1));
  const allRows = doseRows(patientId, 'AND d.dose_date >= ? AND d.dose_date <= ?', [startHistory, today]);
  const allSerialized = allRows.map(serializeDose);
  const todayRows = allRows.filter((row) => row.dose_date === today);
  const overdueCutoff = currentLocalMinutes();

  const todaySummary = {
    total: todayRows.length,
    taken: todayRows.filter((row) => row.status === 'taken').length,
    missed: todayRows.filter((row) => row.status === 'missed').length,
    pending: todayRows.filter((row) => row.status === 'pending').length,
    overdue: todayRows.filter((row) => row.status === 'pending' && minutesFromTime(row.scheduled_time) < overdueCutoff).length,
  };

  const weeklyBreakdown = [];
  const statsByDay = dayStats(allRows);
  for (let offset = -6; offset <= 0; offset += 1) {
    const day = addDays(today, offset);
    const stats = statsByDay.get(day) || { date: day, total: 0, taken: 0, missed: 0, pending: 0 };
    weeklyBreakdown.push({
      date: day,
      taken: stats.taken,
      total: stats.total,
      adherence: dailyAdherence(stats),
    });
  }

  const last6Weeks = [];
  for (let week = 5; week >= 0; week -= 1) {
    const end = addDays(yesterday, -(week * 7));
    const start = addDays(end, -6);
    last6Weeks.push({
      start,
      end,
      label: `${start.slice(5)}-${end.slice(5)}`,
      adherence: adherenceForRange(allRows, start, end),
    });
  }

  return {
    today: todaySummary,
    weeklyBreakdown,
    thirtyDayScore: adherenceForRange(allRows, start30, today),
    thisWeekAdherence: adherenceForRange(allRows, addDays(today, -7), today),
    lastWeekAdherence: adherenceForRange(allRows, addDays(today, -14), addDays(today, -8)),
    currentStreak: currentStreak(allRows, today),
    personalBestStreak: personalBestStreak(allRows, today),
    last6Weeks,
    refills: refillPredictions(patientId),
    consecutiveMissNudge: consecutiveMissNudge(patientId),
    recentNotes: recentNotes(patientId),
    historySize: allSerialized.length,
  };
}
