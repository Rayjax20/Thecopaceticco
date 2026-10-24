// admin.js — staff login + dashboard + booking actions
// ============================================================
//  🔑  PUT YOUR SUPABASE KEYS HERE (same as booking.js)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL = 'https://agpztpuugtifmnrnrhgx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncHp0cHV1Z3RpZm1ucm5yaGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTg0MzMsImV4cCI6MjEwODMzNDQzM30.jFZWhHc2bT7PnPRhtv6GpSZdZz-yvTwmAckgF8vf-og';
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

// ---- Status colors ----
const STATUS = {
  pending:   'gold',
  confirmed: 'green',
  done:      'muted',
  no_show:   'red',
};

// ---- On load: check for an existing session ----
(async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await enterDashboard(session.user.id);
  } else {
    loginScreen.style.display = 'flex';
  }
})();

// ---- Login ----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = 'Wrong email or password.';
    return;
  }
  await enterDashboard(data.user.id);
});

// ---- Enter dashboard (checks role) ----
async function enterDashboard(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'barber')) {
    await supabase.auth.signOut();
    loginError.textContent = 'This account is not staff.';
    loginScreen.style.display = 'flex';
    return;
  }

  loginScreen.style.display = 'none';
  dashboard.hidden = false;
  await loadDashboard();
}

// ---- Load today's schedule + week + services ----
async function loadDashboard() {
  const today = new Date().toISOString().split('T')[0];

  const { data: todays } = await supabase
    .from('bookings')
    .select('*')
    .eq('date', today)
    .order('time');
  renderDay(todays || []);

  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    week.push(d.toISOString().split('T')[0]);
  }
  const { data: weekBookings } = await supabase
    .from('bookings')
    .select('*')
    .in('date', week)
    .order('date');
  renderWeek(weekBookings || []);

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('price');
  renderServices(services || []);

  renderStats(todays || []);
}

// ---- Render today as time blocks 8AM–8PM ----
function renderDay(bookings) {
  const container = document.getElementById('daySchedule');
  container.innerHTML = '';

  for (let h = 8; h < 20; h++) {
    const slot = document.createElement('div');
    slot.className = 'time-slot';

    const label = document.createElement('span');
    label.className = 'slot-time';
    label.textContent = formatHour(h);
    slot.appendChild(label);

    const match = bookings.find((b) => parseInt(b.time.slice(0, 2), 10) === h);
    if (match) {
      slot.className += ` has-booking ${STATUS[match.status] || 'gold'}`;
      const card = document.createElement('div');
      card.className = 'booking-card';
      card.innerHTML = `<strong>${escapeHtml(match.name)}</strong><span>${escapeHtml(match.service)}</span>`;
      slot.appendChild(card);

      const actions = document.createElement('div');
      actions.className = 'booking-actions';
      if (match.status !== 'confirmed') {
        actions.appendChild(actionBtn('Confirm', 'confirmed', match.id));
      }
      if (match.status !== 'done') {
        actions.appendChild(actionBtn('Done', 'done', match.id));
      }
      if (match.status !== 'no_show') {
        actions.appendChild(actionBtn('No-Show', 'no_show', match.id));
      }
      slot.appendChild(actions);
    } else {
      const empty = document.createElement('span');
      empty.className = 'slot-empty';
      empty.textContent = '—';
      slot.appendChild(empty);
    }

    container.appendChild(slot);
  }
}

// ---- Action button helper ----
function actionBtn(text, status, id) {
  const btn = document.createElement('button');
  btn.className = 'act-btn';
  btn.textContent = text;
  btn.addEventListener('click', async () => {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);
    if (error) {
      alert('Could not update booking.');
      console.error(error);
    } else {
      await loadDashboard();
    }
  });
  return btn;
}

// ---- Render the 7-day strip ----
function renderWeek(bookings) {
  const strip = document.getElementById('weekStrip');
  strip.innerHTML = '';

  const byDate = {};
  bookings.forEach((b) => {
    byDate[b.date] = byDate[b.date] || [];
    byDate[b.date].push(b);
  });

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split('T')[0];

    const card = document.createElement('div');
    card.className = 'week-day';
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const count = (byDate[iso] || []).length;

    card.innerHTML = `<strong>${dayName}</strong><span>${dayNum}</span><em>${count} booking${count === 1 ? '' : 's'}</em>`;
    strip.appendChild(card);
  }
}

// ---- Render services ----
function renderServices(services) {
  const list = document.getElementById('serviceList');
  list.innerHTML = '';
  services.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'service-item';
    item.innerHTML = `<span>${escapeHtml(s.name)}</span><strong>$${s.price}</strong>`;
    list.appendChild(item);
  });
}

// ---- Stats ----
function renderStats(todays) {
  const pending = todays.filter((b) => b.status === 'pending').length;
  const confirmed = todays.filter((b) => b.status === 'confirmed').length;
  document.getElementById('statToday').textContent = todays.length;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statConfirmed').textContent = confirmed;
}

// ---- Log out ----
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

// ---- Helpers ----
function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
