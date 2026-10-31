const SUPABASE_URL = 'https://agpztpuugtifmnrnrhgx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncHp0cHV1Z3RpZm1ucm5yaGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTg0MzMsImV4cCI6MjEwODMzNDQzM30.jFZWhHc2bT7PnPRhtv6GpSZdZz-yvTwmAckgF8vf-og';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authGate = document.getElementById('authGate');
const bookingArea = document.getElementById('bookingArea');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authPhone = document.getElementById('authPhone');
const phoneWrap = document.getElementById('phoneAuthWrap');
const authError = document.getElementById('authError');
const authSubmit = document.getElementById('authSubmit');
let authMode = 'signin';

document.querySelectorAll('[data-auth-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    authMode = button.dataset.authMode;
    document.querySelectorAll('[data-auth-mode]').forEach((tab) => tab.classList.toggle('active', tab === button));
    phoneWrap.hidden = authMode !== 'signup';
    authPhone.required = authMode === 'signup';
    authPassword.autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
    authSubmit.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In';
    authError.textContent = '';
  });
});

async function savePhoneProfile(user, phone) {
  const { error } = await sb.from('profiles').upsert({ id:user.id, phone });
  if (error) console.error('Could not save profile phone:', error);
}

async function showBooking(user) {
  authGate.hidden = true;
  bookingArea.hidden = false;
  document.getElementById('accountEmail').textContent = user.email || '';
  const { data } = await sb.from('profiles').select('phone').eq('id',user.id).maybeSingle();
  document.getElementById('contact').value = data?.phone || user.user_metadata?.phone || '';
}

async function init() {
  const { data:{ session } } = await sb.auth.getSession();
  if (session) await showBooking(session.user);
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authError.textContent = '';
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (authMode === 'signup') {
    const phone = authPhone.value.trim();
    if (!phone) { authError.textContent = 'Phone number is required.'; return; }
    const { data,error } = await sb.auth.signUp({ email,password,options:{ data:{ phone } } });
    if (error) { authError.textContent = error.message; return; }
    if (!data.session) { authError.textContent = 'Account created. Check your email to confirm your account, then sign in.'; return; }
    await savePhoneProfile(data.user,phone);
    await showBooking(data.user);
  } else {
    const { data,error } = await sb.auth.signInWithPassword({ email,password });
    if (error) { authError.textContent = 'Wrong email or password.'; return; }
    await showBooking(data.user);
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  bookingArea.hidden = true;
  authGate.hidden = false;
  authForm.reset();
});

const form = document.getElementById('bookingForm');
const dateInput = document.getElementById('date');
const timeInput = document.getElementById('time');
const availabilityMessage = document.getElementById('availabilityMessage');
const serviceSummary = document.getElementById('serviceSummary');
const mainInputs = [...form.querySelectorAll('input[name="mainService"]')];
const addInputs = [...form.querySelectorAll('input[name="addOn"]')];

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate()+1);
dateInput.min = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

function selectedServices() {
  const main = mainInputs.find((input) => input.checked);
  if (!main) return [];
  if (main.value === 'The Full Copacetic') return [{ ...main.dataset,value:main.value }];
  return [{ ...main.dataset,value:main.value },...addInputs.filter((input) => input.checked).map((input) => ({ ...input.dataset,value:input.value }))];
}

function updateSummary() {
  const services = selectedServices();
  if (!services.length) { serviceSummary.textContent = 'Choose a main service to see your appointment length and total.'; return; }
  const duration = services.reduce((total,service) => total+Number(service.duration),0);
  const price = services.reduce((total,service) => total+Number(service.price),0);
  serviceSummary.textContent = `Estimated appointment: ${duration} minutes · $${price}`;
}

function timeToMinutes(time) {
  const match = /^(\d{2}):(\d{2})/.exec(time || '');
  return match ? Number(match[1])*60+Number(match[2]) : null;
}
function formatTime(minutes) {
  const hour = Math.floor(minutes/60);
  const minute = minutes%60;
  return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
}
function serviceDuration(serviceName) {
  const durations = {'Signature Cut':30,'Line Up Only':25,'Relaxed Face Shave':15,'Beard Addition':10,'Hair Trim Addition':20,'The Full Copacetic':60};
  return serviceName.split(' + ').reduce((total,name) => total+(durations[name.trim()]||0),0)||45;
}

async function loadAvailability() {
  const services = selectedServices();
  const date = dateInput.value;
  timeInput.innerHTML = '<option value="">Choose an available time</option>';
  if (!date || !services.length) { timeInput.disabled = true; availabilityMessage.textContent = 'Choose a service and date to see available appointment times.'; return; }
  availabilityMessage.textContent = 'Checking availability…';
  const duration = services.reduce((total,service) => total+Number(service.duration),0);
  const [bookingsResult,blackoutsResult] = await Promise.all([
    sb.from('bookings').select('time,service_name,status').eq('date',date),
    sb.from('blackouts').select('start_time,end_time').eq('date',date)
  ]);
  if (bookingsResult.error || blackoutsResult.error) { timeInput.disabled = true; availabilityMessage.textContent = 'Availability could not be loaded. Please try again.'; return; }
  const bookings = (bookingsResult.data||[]).filter((booking) => booking.status !== 'cancelled').map((booking) => {
    const start = timeToMinutes(booking.time);
    return {start,end:start+serviceDuration(booking.service_name||'')+10};
  }).filter((booking) => booking.start!==null);
  const blackouts = (blackoutsResult.data||[]).map((item) => ({start:timeToMinutes(item.start_time),end:timeToMinutes(item.end_time)}));
  let count = 0;
  const footprint = duration+10;
  for (let start=480;start+footprint<=1200;start+=15) {
    const end = start+footprint;
    const booked = bookings.some((booking) => start<booking.end && booking.start<end);
    const blocked = blackouts.some((window) => start<window.end && window.start<end);
    if (!booked&&!blocked) {
      const option = document.createElement('option');
      option.value = `${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`;
      option.textContent = formatTime(start);
      timeInput.appendChild(option);
      count++;
    }
  }
  timeInput.disabled = count===0;
  availabilityMessage.textContent = count ? `${count} available start times for your selected services.` : 'No times are available for this service on that date.';
  if (!count) timeInput.innerHTML = '<option value="">No available times</option>';
}

mainInputs.forEach((input) => input.addEventListener('change', () => {
  const full = input.checked&&input.value==='The Full Copacetic';
  document.getElementById('addOnOptions').disabled = full;
  addInputs.forEach((addInput) => { if (full) addInput.checked=false; });
  updateSummary();
  loadAvailability();
}));
addInputs.forEach((input) => input.addEventListener('change', () => { updateSummary();loadAvailability(); }));
dateInput.addEventListener('change',loadAvailability);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!timeInput.value) return;
  const services = selectedServices();
  const selectedAddOns = addInputs.filter((input) => input.checked).map((input) => input.value);
  const durationMin = services.reduce((total,service) => total+Number(service.duration),0);
  const startsAt = new Date(`${dateInput.value}T${timeInput.value}:00`);
  const endsAt = new Date(startsAt.getTime()+durationMin*60000);
  const { data:{user} } = await sb.auth.getUser();
  const profile = await sb.from('profiles').select('phone').eq('id',user.id).maybeSingle();
  const phone = profile.data?.phone || document.getElementById('contact').value.trim();
  const booking = {
    client_name:document.getElementById('name').value.trim(),
    phone:document.getElementById('contact').value.trim(),
    service_name:services.map((service) => service.value).join(' + '),
    addons:selectedAddOns,
    date:dateInput.value,
    time:timeInput.value,
    starts_at:startsAt.toISOString(),
    ends_at:endsAt.toISOString(),
    notes:document.getElementById('notes').value.trim(),
    status:'confirmed'
  };
  const { error } = await sb.from('bookings').insert(booking);
  if (error) { availabilityMessage.textContent='Something went wrong — please try again or text Rayvon directly.'; console.error(error); return; }
  document.getElementById('modalSummary').textContent = `${booking.service_name} · ${booking.date} at ${formatTime(timeToMinutes(booking.time))}`;
  document.getElementById('bookingModal').hidden=false;
  form.reset();
  document.getElementById('addOnOptions').disabled=false;
  timeInput.innerHTML='<option value="">Choose a service and date first</option>';
  timeInput.disabled=true;
  updateSummary();
});

document.getElementById('closeModal').addEventListener('click', () => { document.getElementById('bookingModal').hidden=true; });
init();
