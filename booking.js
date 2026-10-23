// booking.js — calendar + hourly slot picker + Supabase insert
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
//  🔑  PUT YOUR SUPABASE KEYS HERE
// ============================================================
//  Go to Supabase → your project → Settings (gear icon) → API
//  Copy these two values and paste them below.
const SUPABASE_URL = 'https://agpztpuugtifmnrnrhgx.supabase.co';  
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncHp0cHV1Z3RpZm1ucm5yaGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTg0MzMsImV4cCI6MjEwODMzNDQzM30.jFZWhHc2bT7PnPRhtv6GpSZdZz-yvTwmAckgF8vf-og'; 
// ============================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Config -------------------------------------------------
const OPEN_HOUR = 8;      // 8:00 AM
const CLOSE_HOUR = 20;    // 8:00 PM (last slot starts at 7:00 PM)
const DAYS_OPEN = [0, 1, 2, 3, 4, 5, 6]; // open every day (0=Sun ... 6=Sat)

// ---- Grab form elements -------------------------------------
const form = document.getElementById('bookingForm');
const nameEl = document.getElementById('name');
const serviceEl = document.getElementById('service');
const dateEl = document.getElementById('date');
const timeEl = document.getElementById('time');
const notesEl = document.getElementById('notes');

// ---- Service durations (minutes) — keep in sync with services table
const DURATIONS = {
  'Signature Cut — $30': 45,
  'Line Up Treatment — $20': 25,
  'Beard Addition — $10': 10,
  'Relaxed Face Shave — $10': 10,
  'Hair Trim Addition — $15': 15,
  'The Full Copacetic — $60': 60,
};

// ---- Restrict date picker: no past dates --------------------
const today = new Date();
dateEl.min = today.toISOString().split('T')[0];

// ---- Build top-of-the-hour time options ---------------------
function buildTimeOptions() {
  timeEl.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = 'Choose a time';
  timeEl.appendChild(opt);

  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    const label = formatHour(h);
    const opt = document.createElement('option');
    opt.value = `${String(h).padStart(2, '0')}:00`;
    opt.textContent = label;
    timeEl.appendChild(opt);
  }
}
buildTimeOptions();

function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

// ---- Disable slots already taken for the chosen date --------
async function updateAvailableTimes() {
  if (!dateEl.value) return;

  // Reset all options to enabled
  [...timeEl.options].forEach((o) => { o.disabled = false; });

  // Fetch bookings for that date
  const { data, error } = await supabase
    .from('bookings')
    .select('time, service')
    .eq('date', dateEl.value);

  if (error) {
    console.error('Could not load availability:', error);
    return;
  }

  // Build a set of taken start times
  const taken = new Set();
  data.forEach((b) => {
    const start = parseInt(b.time.slice(0, 2), 10);
    const dur = DURATIONS[b.service] || 45;
    const blocks = Math.ceil(dur / 60);
    for (let i = 0; i < blocks; i++) {
      taken.add(start + i);
    }
  });

  // Disable taken slots
  [...timeEl.options].forEach((o) => {
    if (!o.value) return;
    const h = parseInt(o.value.slice(0, 2), 10);
    if (taken.has(h)) o.disabled = true;
  });
}

dateEl.addEventListener('change', updateAvailableTimes);

// ---- Submit: insert into Supabase ---------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const booking = {
    name: nameEl.value.trim(),
    service: serviceEl.value,
    date: dateEl.value,
    time: timeEl.value,
    notes: notesEl.value.trim(),
    status: 'pending',
  };

  const { error } = await supabase
    .from('bookings')
    .insert(booking);

  if (error) {
    alert('Something went wrong — please try again or text Rayvon directly.');
    console.error(error);
  } else {
    alert('Booking request sent! Rayvon will confirm your time by text.');
    form.reset();
    buildTimeOptions();
  }
});
