import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Flame,
  HeartPulse,
  Home,
  Leaf,
  LockKeyhole,
  Package,
  Pill,
  Sparkles,
  SkipForward,
  Trophy,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  default as React,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from './api';
import {
  addDays,
  formatDate,
  formatDayName,
  formatScheduledTime,
  formatTakenTime,
  isOverdue,
  minutesFromTime,
  nowMinutes,
  plural,
  roundOne,
  sortDoses,
  statusKind,
  statusLabel,
  todayKey,
} from './utils';

const STORAGE_KEY = 'everhopePatientId';
const PatientDataContext = createContext(null);

function usePatientData() {
  const context = useContext(PatientDataContext);
  if (!context) throw new Error('Patient data context is missing');
  return context;
}

function updateDoseInList(list, doseId, changes) {
  return list.map((dose) => (dose.id === doseId ? { ...dose, ...changes } : dose));
}

function PatientDataProvider({ patientId, children }) {
  const [patient, setPatient] = useState(null);
  const [todayDoses, setTodayDoses] = useState([]);
  const [history, setHistory] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [symptomDoseId, setSymptomDoseId] = useState(null);
  const [confirmations, setConfirmations] = useState({});

  const refresh = useCallback(async () => {
    setError('');
    const [patientData, todaysDoseData, historyData, adherenceData] = await Promise.all([
      api.patient(patientId),
      api.todayDoses(patientId),
      api.history(patientId, 45),
      api.adherence(patientId),
    ]);
    setPatient(patientData);
    setTodayDoses(todaysDoseData);
    setHistory(historyData);
    setAdherence(adherenceData);
  }, [patientId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((err) => {
        if (active) setError(err.message || 'Could not load your companion.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const refreshQuietly = useCallback(() => {
    refresh().catch((err) => setError(err.message || 'Could not refresh your companion.'));
  }, [refresh]);

  const markTaken = useCallback(async (dose) => {
    const takenAt = new Date().toISOString();
    setTodayDoses((items) => updateDoseInList(items, dose.id, {
      status: 'taken',
      taken_at: takenAt,
    }));
    setHistory((items) => updateDoseInList(items, dose.id, {
      status: 'taken',
      taken_at: takenAt,
    }));
    setConfirmations((items) => ({
      ...items,
      [dose.id]: `Logged at ${formatTakenTime(takenAt)} ✓`,
    }));
    setSymptomDoseId(dose.id);

    try {
      await api.markTaken(dose.id, takenAt);
      refreshQuietly();
    } catch (err) {
      setError(err.message || 'Could not log this dose.');
      refreshQuietly();
    }
  }, [refreshQuietly]);

  const markMissed = useCallback(async (dose) => {
    setTodayDoses((items) => updateDoseInList(items, dose.id, {
      status: 'missed',
      taken_at: null,
      symptom_note: null,
    }));
    setHistory((items) => updateDoseInList(items, dose.id, {
      status: 'missed',
      taken_at: null,
      symptom_note: null,
    }));
    setConfirmations((items) => ({
      ...items,
      [dose.id]: 'Skipped for today',
    }));
    setSymptomDoseId(null);

    try {
      await api.markMissed(dose.id);
      refreshQuietly();
    } catch (err) {
      setError(err.message || 'Could not update this dose.');
      refreshQuietly();
    }
  }, [refreshQuietly]);

  const saveSymptom = useCallback(async (doseId, note) => {
    const cleanNote = note.trim();
    if (!cleanNote) return;
    setTodayDoses((items) => updateDoseInList(items, doseId, { symptom_note: cleanNote }));
    setHistory((items) => updateDoseInList(items, doseId, { symptom_note: cleanNote }));
    setSymptomDoseId(null);
    try {
      await api.symptom(doseId, cleanNote);
      refreshQuietly();
    } catch (err) {
      setError(err.message || 'Could not save your note.');
      refreshQuietly();
    }
  }, [refreshQuietly]);

  const value = useMemo(() => ({
    patient,
    todayDoses,
    history,
    adherence,
    loading,
    error,
    symptomDoseId,
    confirmations,
    markTaken,
    markMissed,
    saveSymptom,
    dismissSymptom: () => setSymptomDoseId(null),
    refresh: refreshQuietly,
  }), [
    adherence,
    confirmations,
    error,
    history,
    loading,
    markMissed,
    markTaken,
    patient,
    refreshQuietly,
    saveSymptom,
    symptomDoseId,
    todayDoses,
  ]);

  return (
    <PatientDataContext.Provider value={value}>
      {children}
    </PatientDataContext.Provider>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/schedule" element={<ScheduleScreen />} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/supplements" element={<SupplementsScreen />} />
        <Route path="/log/:doseId" element={<DoseLogScreen />} />
        <Route path="/streak" element={<StreakDetailsScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProtectedLayout() {
  const patientId = Number(localStorage.getItem(STORAGE_KEY));
  if (!patientId) return <Navigate to="/" replace />;

  return (
    <PatientDataProvider patientId={patientId}>
      <AppFrame>
        <Outlet />
      </AppFrame>
    </PatientDataProvider>
  );
}

function AppFrame({ children }) {
  return (
    <div className="phone-shell">
      <main className="screen-content">{children}</main>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: '/home', label: 'Home', icon: Home },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
    { to: '/supplements', label: 'Supplements', icon: Package },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} className="nav-item">
            <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function WelcomeScreen() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.patients()
      .then(setPatients)
      .catch((err) => setError(err.message || 'Could not load profiles.'))
      .finally(() => setLoading(false));
  }, []);

  const choosePatient = (patientId) => {
    localStorage.setItem(STORAGE_KEY, String(patientId));
    navigate('/home');
  };

  return (
    <div className="phone-shell welcome-shell">
      <main className="welcome-screen">
        <div className="brand-lockup">
          <Leaf size={32} aria-hidden="true" />
          <span>Everhope</span>
        </div>
        <section className="welcome-copy">
          <h1>Choose your profile</h1>
          <p>Your personal supplement companion.</p>
        </section>

        {loading && <LoadingCard label="Loading profiles" />}
        {error && <InlineError message={error} />}

        <div className="profile-grid">
          {patients.map((patient) => (
            <button
              className="profile-card"
              key={patient.id}
              type="button"
              onClick={() => choosePatient(patient.id)}
              style={{ '--avatar-color': patient.avatar_color }}
            >
              <span className="avatar large">{patient.avatar_initials}</span>
              <span className="profile-name">{patient.name}</span>
              <span className="profile-detail">{patient.cancer_type}</span>
              <span className="profile-phase">{patient.treatment_phase}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function HomeScreen() {
  const {
    patient,
    todayDoses,
    adherence,
    loading,
    error,
    confirmations,
    symptomDoseId,
    markTaken,
    markMissed,
  } = usePatientData();
  const navigate = useNavigate();

  if (loading && !patient) return <LoadingCard label="Preparing your day" />;
  if (error && !patient) return <InlineError message={error} />;

  const sortedDoses = sortDoses(todayDoses);
  const pendingDoses = sortedDoses.filter((dose) => dose.status === 'pending');
  const nextDose = pendingDoses[0] || null;
  const summary = adherence?.today || { total: 0, taken: 0, pending: 0, missed: 0, overdue: 0 };
  const allTaken = summary.total > 0 && summary.taken === summary.total;
  const noPending = summary.total > 0 && summary.pending === 0;
  const tomorrowPreview = makePreviewDoses(patient?.products || [], addDays(todayKey(), 1));
  const showTomorrowMorning = noPending && nowMinutes() >= 21 * 60 && tomorrowPreview.length > 0;

  return (
    <Page>
      <GreetingHeader patient={patient} summary={summary} />
      <section className="home-glance-grid" aria-label="Today at a glance">
        <TodayDoseOverview summary={summary} />
        <StreakCard adherence={adherence} />
      </section>
      <NudgeCard nudge={adherence?.consecutiveMissNudge} />

      {nextDose && (
        <NextDoseCard
          dose={nextDose}
          confirmation={confirmations[nextDose.id]}
          showSymptom={symptomDoseId === nextDose.id}
          onTaken={() => markTaken(nextDose)}
          onMissed={() => markMissed(nextDose)}
        />
      )}

      {!nextDose && showTomorrowMorning && (
        <TomorrowNextCard dose={tomorrowPreview[0]} />
      )}

      {!nextDose && !showTomorrowMorning && (
        <CompletionCard allTaken={allTaken} />
      )}

      <SectionTitle eyebrow="Today" title="Your doses" />
      <div className="compact-list">
        {sortedDoses.map((dose) => (
          <button
            key={dose.id}
            className={`dose-row ${statusKind(dose)}`}
            type="button"
            onClick={() => navigate(`/log/${dose.id}`)}
          >
            <span>
              <strong>{dose.product.name}</strong>
              <small>{formatScheduledTime(dose.scheduled_time)}</small>
            </span>
            <StatusChip dose={dose} />
          </button>
        ))}
      </div>

      <QuickStats adherence={adherence} />
    </Page>
  );
}

function TodayDoseOverview({ summary }) {
  const missedCount = summary.missed || 0;

  return (
    <section className={`today-overview card ${missedCount > 0 ? 'has-missed' : ''}`}>
      <p className="eyebrow">Today</p>
      <div className="today-count-line">
        <strong>{summary.taken || 0}</strong>
        <span>of {summary.total || 0}</span>
      </div>
      <p className="overview-note">doses taken</p>
      {missedCount > 0 && <span className="missed-pill">{missedCount} skipped</span>}
    </section>
  );
}

function GreetingHeader({ patient, summary }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  let line = 'Your supplement plan is ready for today.';

  if (summary.overdue > 0) {
    line = 'You have a dose overdue — let’s catch up.';
  } else if (summary.pending > 0) {
    line = `You have ${summary.pending} ${plural(summary.pending, 'dose')} coming up today.`;
  } else if (summary.total > 0 && summary.taken === summary.total) {
    line = 'You’ve taken all your doses today. Well done.';
  } else if (summary.total > 0) {
    line = 'Your schedule is finished for today.';
  }

  return (
    <header className="greeting-card">
      <div>
        <p className="eyebrow">Today</p>
        <h1>{greeting}, {patient?.name}.</h1>
        <p>{line}</p>
      </div>
      <span
        className="avatar"
        style={{ '--avatar-color': patient?.avatar_color || '#1A7F5A' }}
      >
        {patient?.avatar_initials}
      </span>
    </header>
  );
}

function StreakCard({ adherence }) {
  const streak = adherence?.currentStreak || 0;
  const best = adherence?.personalBestStreak || 0;
  const navigate = useNavigate();

  return (
    <button className="streak-card card" type="button" onClick={() => navigate('/streak')}>
      <div className="streak-icon compact" aria-hidden="true">
        <Flame size={20} />
      </div>
      <div>
        <div className="streak-number">{streak}</div>
        <p className="streak-label">day streak</p>
        <p className="muted">Best {best} {plural(best, 'day')}</p>
      </div>
    </button>
  );
}

function NextDoseCard({ dose, confirmation, showSymptom, onTaken, onMissed }) {
  return (
    <section className={`next-dose card ${isOverdue(dose) ? 'overdue-card' : ''}`}>
      <div className="card-topline">
        <p className="eyebrow">Next dose</p>
        <StatusChip dose={dose} />
      </div>
      <h2>{dose.product.name}</h2>
      <p className="dose-time">{formatScheduledTime(dose.scheduled_time)}</p>
      <p className="strong-line">{dose.product.dosage}</p>
      <p>{dose.product.instruction}</p>
      {confirmation && <p className="inline-confirm">{confirmation}</p>}
      <DoseActions dose={dose} onTaken={onTaken} onMissed={onMissed} />
      {showSymptom && <SymptomPrompt doseId={dose.id} />}
    </section>
  );
}

function TomorrowNextCard({ dose }) {
  return (
    <section className="next-dose card">
      <p className="eyebrow">Tomorrow morning</p>
      <h2>{dose.product.name}</h2>
      <p className="dose-time">{formatScheduledTime(dose.scheduled_time)}</p>
      <p className="strong-line">{dose.product.dosage}</p>
      <p>{dose.product.instruction}</p>
    </section>
  );
}

function CompletionCard({ allTaken }) {
  return (
    <section className="completion-card card">
      <div className="completion-icon" aria-hidden="true">
        <Leaf size={28} />
      </div>
      <h2>{allTaken ? 'All done for today 🌿' : 'Your schedule is finished for today.'}</h2>
      <p>{allTaken ? 'See you tomorrow.' : 'The next dose will appear when it is time.'}</p>
    </section>
  );
}

function QuickStats({ adherence }) {
  const today = adherence?.today || { taken: 0, total: 0 };
  const stats = [
    { label: 'Today', value: `${today.taken} of ${today.total}`, helper: 'taken' },
    { label: 'This week', value: `${adherence?.thisWeekAdherence ?? 0}%`, helper: 'adherence' },
    { label: 'Streak', value: `${adherence?.currentStreak ?? 0}`, helper: 'days' },
  ];

  return (
    <section className="quick-stats">
      {stats.map((item) => (
        <div className="metric-tile" key={item.label}>
          <p>{item.label}</p>
          <strong>{item.value}</strong>
          <span>{item.helper}</span>
        </div>
      ))}
    </section>
  );
}

function ScheduleScreen() {
  const {
    patient,
    todayDoses,
    adherence,
    loading,
    error,
    confirmations,
    symptomDoseId,
    markTaken,
    markMissed,
  } = usePatientData();

  if (loading && !patient) return <LoadingCard label="Loading your schedule" />;
  if (error && !patient) return <InlineError message={error} />;

  const sorted = sortDoses(todayDoses);
  const tomorrow = makePreviewDoses(patient?.products || [], addDays(todayKey(), 1));

  return (
    <Page>
      <PageHeader title="Schedule" subtitle="Today’s supplement plan, in order." />
      <NudgeCard nudge={adherence?.consecutiveMissNudge} />

      <section className="stack">
        {sorted.map((dose) => (
          <ScheduleDoseCard
            key={dose.id}
            dose={dose}
            confirmation={confirmations[dose.id]}
            showSymptom={symptomDoseId === dose.id}
            onTaken={() => markTaken(dose)}
            onMissed={() => markMissed(dose)}
          />
        ))}
      </section>

      <SectionTitle eyebrow="Preview" title="Tomorrow" />
      <div className="stack compact-stack">
        {tomorrow.map((dose) => (
          <article className="tomorrow-row card" key={`${dose.product.id}-${dose.scheduled_time}`}>
            <Pill size={19} aria-hidden="true" />
            <div>
              <strong>{dose.product.name}</strong>
              <p>{formatScheduledTime(dose.scheduled_time)} · {dose.product.dosage}</p>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function ScheduleDoseCard({ dose, confirmation, showSymptom, onTaken, onMissed }) {
  const [open, setOpen] = useState(false);

  return (
    <article className={`schedule-card card ${statusKind(dose) === 'overdue' ? 'overdue-card' : ''}`}>
      <div className="card-topline">
        <p className="eyebrow">{formatScheduledTime(dose.scheduled_time)}</p>
        <StatusChip dose={dose} />
      </div>
      <h2>{dose.product.name}</h2>
      <p className="muted">{dose.product.short_desc}</p>
      <p className="strong-line">{dose.product.dosage}</p>
      <p>{dose.product.instruction}</p>
      {dose.status === 'taken' && dose.taken_at && (
        <p className="inline-confirm">Taken at {formatTakenTime(dose.taken_at)} ✓</p>
      )}
      {confirmation && <p className="inline-confirm">{confirmation}</p>}

      <button className="why-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        <span>Why this supplement?</span>
        <ChevronDown className={open ? 'rotate' : ''} size={18} aria-hidden="true" />
      </button>
      {open && <p className="why-copy">{dose.product.why_it_helps}</p>}

      <DoseActions dose={dose} onTaken={onTaken} onMissed={onMissed} />
      {showSymptom && <SymptomPrompt doseId={dose.id} />}
    </article>
  );
}

function ProgressScreen() {
  const { patient, history, adherence, loading, error } = usePatientData();

  if (loading && !patient) return <LoadingCard label="Gathering your progress" />;
  if (error && !patient) return <InlineError message={error} />;

  const notes = history
    .filter((dose) => dose.symptom_note)
    .sort((a, b) => `${b.dose_date}${b.scheduled_time}`.localeCompare(`${a.dose_date}${a.scheduled_time}`));
  const weeklyData = (adherence?.last6Weeks || []).map((week) => ({
    ...week,
    adherence: week.adherence ?? 0,
  }));

  return (
    <Page>
      <PageHeader title="Progress" subtitle="Your rhythm, notes, and trends." />

      <section className="progress-hero card">
        <div>
          <p className="eyebrow">30-day adherence</p>
          <strong>{adherence?.thirtyDayScore ?? 0}%</strong>
          <p>Current streak: {adherence?.currentStreak ?? 0} {plural(adherence?.currentStreak ?? 0, 'day')}</p>
        </div>
        <div className="progress-best">
          <Flame size={22} aria-hidden="true" />
          <span>{adherence?.personalBestStreak ?? 0}</span>
          <small>personal best</small>
        </div>
      </section>

      <SectionTitle eyebrow="Last 7 days" title="Daily adherence" />
      <div className="day-strip">
        {(adherence?.weeklyBreakdown || []).map((day) => (
          <div className="day-pill" key={day.date}>
            <span>{formatDayName(day.date)}</span>
            <strong>{day.adherence === null ? '—' : `${day.adherence}%`}</strong>
          </div>
        ))}
      </div>

      <section className="card chart-card">
        <div className="section-heading tight">
          <p className="eyebrow">Trend</p>
          <h2>Last 6 weeks</h2>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value) => [`${roundOne(value)}%`, 'Adherence']}
                contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB' }}
              />
              <Bar dataKey="adherence" fill="#1A7F5A" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <WeeklyInsight patient={patient} adherence={adherence} />

      <section className="card">
        <div className="section-heading tight">
          <p className="eyebrow">Journal</p>
          <h2>Your notes</h2>
        </div>
        {notes.length === 0 && (
          <p className="muted">No notes yet — you can add notes after taking a dose.</p>
        )}
        {notes.length > 0 && (
          <div className="notes-list">
            {notes.map((dose) => (
              <article className="note-item" key={`${dose.id}-${dose.symptom_note}`}>
                <p>{dose.symptom_note}</p>
                <span>{formatDate(dose.dose_date)} · {formatScheduledTime(dose.scheduled_time)} · {dose.product.name}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}

function StreakDetailsScreen() {
  const { patient, history, adherence, loading, error } = usePatientData();
  const navigate = useNavigate();

  if (loading && !patient) return <LoadingCard label="Opening your streak" />;
  if (error && !patient) return <InlineError message={error} />;

  const currentStreak = adherence?.currentStreak || 0;
  const personalBest = adherence?.personalBestStreak || 0;
  const currentStart = currentStreak > 0
    ? addDays(todayKey(), -(currentStreak - 1))
    : null;
  const bestWindow = findBestStreakWindow(history);
  const rewards = streakRewards();
  const nextReward = rewards.find((reward) => reward.days > currentStreak) || rewards[rewards.length - 1];

  return (
    <Page>
      <button className="back-link" type="button" onClick={() => navigate('/home')}>
        <ArrowLeft size={18} aria-hidden="true" />
        Home
      </button>

      <section className="streak-detail-hero card">
        <div className="streak-detail-icon" aria-hidden="true">
          <Flame size={28} />
        </div>
        <p className="eyebrow">Your streak</p>
        <h1>{currentStreak} {plural(currentStreak, 'day')}</h1>
        <p>
          {currentStart
            ? `This streak started on ${formatDate(currentStart)}.`
            : 'Start your streak today by completing your planned doses.'}
        </p>
      </section>

      <section className="streak-detail-grid">
        <div className="card streak-mini-stat">
          <Trophy size={20} aria-hidden="true" />
          <span>Highest streak</span>
          <strong>{personalBest} {plural(personalBest, 'day')}</strong>
          <p>
            {bestWindow?.start && bestWindow?.end
              ? `${formatDate(bestWindow.start)} to ${formatDate(bestWindow.end)}`
              : 'Your best streak will appear here.'}
          </p>
        </div>
        <div className="card streak-mini-stat">
          <Sparkles size={20} aria-hidden="true" />
          <span>Next unlock</span>
          <strong>{nextReward.days} days</strong>
          <p>{nextReward.title}</p>
        </div>
      </section>

      <section className="card">
        <div className="section-heading tight">
          <p className="eyebrow">Rewards</p>
          <h2>Consistency unlocks support</h2>
        </div>
        <div className="reward-list">
          {rewards.map((reward) => {
            const unlocked = currentStreak >= reward.days;
            return (
              <article className={`reward-item ${unlocked ? 'unlocked' : ''}`} key={reward.days}>
                <div className="reward-icon" aria-hidden="true">
                  {unlocked ? <Check size={18} /> : <LockKeyhole size={18} />}
                </div>
                <div>
                  <span>{reward.days}-day step</span>
                  <strong>{reward.title}</strong>
                  <p>{reward.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="section-heading tight">
          <p className="eyebrow">How it works</p>
          <h2>Keep an 80% day</h2>
        </div>
        <p className="muted">
          A streak day counts when you complete at least 80% of your planned doses. Skipping a dose does not erase your effort; it simply gives tomorrow a fresh place to begin.
        </p>
      </section>
    </Page>
  );
}

function streakRewards() {
  return [
    {
      days: 3,
      title: 'Gentle rhythm check-in',
      description: 'Unlock a short nutritionist-style reflection to spot what is helping you stay consistent.',
    },
    {
      days: 7,
      title: 'Weekly nutrition review',
      description: 'Unlock a guided review of your supplement routine and symptom notes.',
    },
    {
      days: 14,
      title: 'Therapy support session',
      description: 'Unlock a preparation guide for discussing nutrition support during your treatment phase.',
    },
    {
      days: 30,
      title: 'Care plan celebration',
      description: 'Unlock a deeper consistency review with next-step suggestions for your protocol.',
    },
  ];
}

function findBestStreakWindow(history) {
  const stats = new Map();
  for (const dose of history) {
    if (!stats.has(dose.dose_date)) {
      stats.set(dose.dose_date, { total: 0, taken: 0 });
    }
    const day = stats.get(dose.dose_date);
    day.total += 1;
    if (dose.status === 'taken') day.taken += 1;
  }

  let current = null;
  let best = null;
  for (const [date, day] of [...stats.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const qualifies = day.total > 0 && (day.taken / day.total) >= 0.8;
    if (!qualifies) {
      current = null;
      continue;
    }
    current = current ? { start: current.start, end: date, length: current.length + 1 } : { start: date, end: date, length: 1 };
    if (!best || current.length > best.length) best = current;
  }
  return best;
}

function WeeklyInsight({ patient, adherence }) {
  const [state, setState] = useState({ loading: true, text: '' });

  useEffect(() => {
    if (!patient || !adherence) return undefined;
    const controller = new AbortController();
    const assignedProducts = patient.products.map((product) => product.name);
    const recentNotes = (adherence.recentNotes || []).map((note) => note.note);
    const weeklyAdherence = adherence.thisWeekAdherence;
    const lastWeekAdherence = adherence.lastWeekAdherence;
    const streak = adherence.currentStreak;
    const prompt = `
You are a warm, supportive nutritionist at Everhope, a cancer nutrition brand.
A patient named ${patient.name} is on ${patient.treatment_phase} for ${patient.cancer_type}.
Their supplement adherence this week was ${weeklyAdherence}%.
Their adherence last week was ${lastWeekAdherence}%.
Their current streak is ${streak} days.
Recent symptom notes they logged: ${recentNotes.join(', ') || 'none'}.
Their assigned supplements are: ${assignedProducts.join(', ')}.

Write a short, warm, personal insight (3–4 sentences maximum) for ${patient.name} about their progress this week.
Acknowledge what they did well. If adherence dropped, be gentle and encouraging — never blame.
If they logged symptoms, acknowledge that and offer one practical tip relevant to their supplement or phase.
End with one specific encouragement for the coming week.
Do not use bullet points. Write as if speaking directly to the patient.
Do not mention Everhope by name.
`;

    setState({ loading: true, text: '' });
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        const insight = data?.content?.[0]?.text;
        setState({
          loading: false,
          text: insight || 'Keep going — consistency is what makes the difference. Every dose counts.',
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            text: 'Keep going — consistency is what makes the difference. Every dose counts.',
          });
        }
      });

    return () => controller.abort();
  }, [adherence, patient]);

  return (
    <section className="insight-card card">
      <div className="section-heading tight">
        <p className="eyebrow">Your weekly insight from our nutritionist</p>
        <h2>For this week</h2>
      </div>
      {state.loading ? (
        <p className="muted">Writing your insight...</p>
      ) : (
        <p>{state.text}</p>
      )}
    </section>
  );
}

function SupplementsScreen() {
  const { patient, adherence, loading, error } = usePatientData();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  if (loading && !patient) return <LoadingCard label="Opening your shelf" />;
  if (error && !patient) return <InlineError message={error} />;

  const refills = new Map((adherence?.refills || []).map((refill) => [refill.productId, refill]));
  const lowRefill = [...refills.values()]
    .filter((refill) => refill.daysRemaining <= 7)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)[0];

  return (
    <Page>
      <PageHeader title="Supplements" subtitle="Your personal protocol shelf." />

      {lowRefill && !bannerDismissed && (
        <section className="refill-banner">
          <div>
            <strong>You’re running low on {lowRefill.productName}.</strong>
            <p>Reorder to avoid a gap in your protocol.</p>
          </div>
          <button type="button" aria-label="Dismiss refill banner" onClick={() => setBannerDismissed(true)}>
            <X size={18} aria-hidden="true" />
          </button>
        </section>
      )}

      <section className="stack">
        {patient?.products.map((product) => (
          <SupplementCard key={product.id} product={product} refill={refills.get(product.id)} />
        ))}
      </section>
    </Page>
  );
}

function SupplementCard({ product, refill }) {
  const visibleDoses = Math.max(0, refill?.dosesRemaining ?? product.capsules_per_pack);
  const visibleDays = Math.max(0, refill?.daysRemaining ?? 0);
  const badge = visibleDays <= 3 ? 'critical' : visibleDays <= 7 ? 'low' : '';

  return (
    <article className="supplement-card card">
      <div className="card-topline">
        <p className="eyebrow">Protocol</p>
        {badge && <span className={`refill-badge ${badge}`}>{badge === 'critical' ? 'Reorder now' : 'Running low'}</span>}
      </div>
      <h2>{product.name}</h2>
      <p className="muted">{product.short_desc}</p>
      <p>{product.why_it_helps}</p>
      <div className="detail-grid">
        <span>
          <strong>Dosage</strong>
          {product.dosage}
        </span>
        <span>
          <strong>Schedule</strong>
          {product.times.map(formatScheduledTime).join(', ')}
        </span>
      </div>
      <p className="instruction-line">{product.instruction}</p>
      <div className="refill-meter">
        <div className="meter-copy">
          <strong>{visibleDoses} doses remaining</strong>
          <span>{visibleDays} {plural(visibleDays, 'day')} until depletion</span>
        </div>
        <div className="meter-track" aria-hidden="true">
          <span style={{ width: `${refill?.fullnessPercent ?? 100}%` }} />
        </div>
      </div>
      <a className="primary-action link-action" href="https://store.everhope.care" target="_blank" rel="noreferrer">
        <Package size={18} aria-hidden="true" />
        Reorder
      </a>
    </article>
  );
}

function DoseLogScreen() {
  const {
    patient,
    todayDoses,
    history,
    loading,
    error,
    confirmations,
    symptomDoseId,
    markTaken,
    markMissed,
  } = usePatientData();
  const { doseId } = useParams();
  const navigate = useNavigate();
  const dose = [...todayDoses, ...history].find((item) => String(item.id) === String(doseId));

  if (loading && !patient) return <LoadingCard label="Opening dose" />;
  if (error && !patient) return <InlineError message={error} />;
  if (!dose) return <InlineError message="This dose could not be found." />;

  return (
    <Page>
      <button className="back-button" type="button" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>

      <article className={`dose-log-card card ${statusKind(dose) === 'overdue' ? 'overdue-card' : ''}`}>
        <div className="card-topline">
          <p className="eyebrow">{formatDate(dose.dose_date)} · {formatScheduledTime(dose.scheduled_time)}</p>
          <StatusChip dose={dose} />
        </div>
        <h1>{dose.product.name}</h1>
        <p className="muted">{dose.product.short_desc}</p>
        <p className="strong-line">{dose.product.dosage}</p>
        <p>{dose.product.instruction}</p>
        <div className="why-panel">
          <strong>Why this supplement?</strong>
          <p>{dose.product.why_it_helps}</p>
        </div>
        {dose.status === 'taken' && dose.taken_at && (
          <p className="inline-confirm">Taken at {formatTakenTime(dose.taken_at)} ✓</p>
        )}
        {confirmations[dose.id] && <p className="inline-confirm">{confirmations[dose.id]}</p>}
        <DoseActions dose={dose} onTaken={() => markTaken(dose)} onMissed={() => markMissed(dose)} />
        {symptomDoseId === dose.id && <SymptomPrompt doseId={dose.id} />}
      </article>
    </Page>
  );
}

function DoseActions({ dose, onTaken, onMissed }) {
  const active = dose.status === 'pending';
  if (!active) return null;

  return (
    <div className="action-row">
      <button className="primary-action" type="button" onClick={onTaken}>
        <Check size={18} aria-hidden="true" />
        Mark as taken
      </button>
      <button className="secondary-action" type="button" onClick={onMissed}>
        <SkipForward size={18} aria-hidden="true" />
        Skip for today
      </button>
    </div>
  );
}

function SymptomPrompt({ doseId }) {
  const { saveSymptom, dismissSymptom } = usePatientData();
  const [note, setNote] = useState('');
  const chips = ['No issues', 'Slight nausea', 'Felt good', 'Some discomfort'];

  return (
    <div className="symptom-prompt">
      <div className="prompt-top">
        <strong>How do you feel?</strong>
        <button type="button" onClick={dismissSymptom} aria-label="Dismiss symptom note">
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="chip-row">
        {chips.map((chip) => (
          <button key={chip} type="button" onClick={() => saveSymptom(doseId, chip)}>
            {chip}
          </button>
        ))}
      </div>
      <div className="note-input-row">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a short note"
          aria-label="Add a short note"
        />
        <button type="button" onClick={() => saveSymptom(doseId, note)}>
          Save
        </button>
      </div>
    </div>
  );
}

function StatusChip({ dose }) {
  const kind = statusKind(dose);
  return <span className={`status-chip ${kind}`}>{statusLabel(dose)}</span>;
}

function NudgeCard({ nudge }) {
  if (!nudge) return null;
  return (
    <section className="nudge-card">
      <HeartPulse size={21} aria-hidden="true" />
      <p>{nudge.message}</p>
    </section>
  );
}

function Page({ children }) {
  return <div className="page-stack">{children}</div>;
}

function PageHeader({ title, subtitle }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

function LoadingCard({ label }) {
  return (
    <div className="card loading-card">
      <span className="loader" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function InlineError({ message }) {
  return (
    <div className="card error-card">
      <p>{message}</p>
    </div>
  );
}

function makePreviewDoses(products, date) {
  return products
    .flatMap((product) => product.times.map((time) => ({
      id: `${product.id}-${date}-${time}`,
      product_id: product.id,
      dose_date: date,
      scheduled_time: time,
      status: 'pending',
      product,
    })))
    .sort((a, b) => minutesFromTime(a.scheduled_time) - minutesFromTime(b.scheduled_time));
}

export default App;
