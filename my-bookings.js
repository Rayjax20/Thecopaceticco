const SUPABASE_URL='https://agpztpuugtifmnrnrhgx.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFncHp0cHV1Z3RpZm1ucm5yaGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NTg0MzMsImV4cCI6MjEwODMzNDQzM30.jFZWhHc2bT7PnPRhtv6GpSZdZz-yvTwmAckgF8vf-og';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

const authGate=document.getElementById('authGate'),accountArea=document.getElementById('accountArea'),authForm=document.getElementById('authForm');
const authEmail=document.getElementById('authEmail'),authPassword=document.getElementById('authPassword'),authPhone=document.getElementById('authPhone'),phoneWrap=document.getElementById('phoneAuthWrap'),authError=document.getElementById('authError'),authSubmit=document.getElementById('authSubmit');
let authMode='signin';
document.querySelectorAll('[data-auth-mode]').forEach((button)=>button.addEventListener('click',()=>{
  authMode=button.dataset.authMode;
  document.querySelectorAll('[data-auth-mode]').forEach((tab)=>tab.classList.toggle('active',tab===button));
  phoneWrap.hidden=authMode!=='signup';authPhone.required=authMode==='signup';authPassword.autocomplete=authMode==='signup'?'new-password':'current-password';authSubmit.textContent=authMode==='signup'?'Create Account':'Sign In';authError.textContent='';
}));

async function loadBookings(user){
  authGate.hidden=true;accountArea.hidden=false;document.getElementById('accountEmail').textContent=user.email||'';
  const {data:profile}=await sb.from('profiles').select('phone').eq('id',user.id).maybeSingle();
  const phone=profile?.phone||user.user_metadata?.phone;
  if(!phone){renderList(document.getElementById('upcomingBookings'),[]);renderList(document.getElementById('pastBookings'),[],true);return;}
  const {data,error}=await sb.from('bookings').select('*').eq('phone',phone).order('date',{ascending:true}).order('time',{ascending:true});
  if(error){authError.textContent='Could not load your bookings.';return;}
  const today=new Date();today.setHours(0,0,0,0);
  const upcoming=[],past=[];
  (data||[]).forEach((booking)=>{
    const bookingDate=new Date(`${booking.date}T${booking.time||'00:00'}`);
    if(booking.status==='cancelled'||bookingDate<today) past.push(booking);else upcoming.push(booking);
  });
  renderList(document.getElementById('upcomingBookings'),upcoming);
  renderList(document.getElementById('pastBookings'),past,true);
}

function renderList(container,bookings,past=false){
  container.innerHTML='';
  if(!bookings.length){container.innerHTML=`<p class="empty-state">${past?'No past appointments yet.':'No upcoming appointments.'}</p>`;return;}
  bookings.forEach((booking)=>{
    const date=new Date(`${booking.date}T00:00:00`);
    const time=new Date(`${booking.date}T${booking.time||'00:00'}:00`);
    const card=document.createElement('article');card.className='booking-card';
    card.innerHTML=`<time datetime="${booking.date}">${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}<br>${time.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</time><div><h3></h3><p></p></div><span class="status status-${booking.status||'confirmed'}">${booking.status||'confirmed'}</span>`;
    card.querySelector('h3').textContent=booking.service_name||'Appointment';
    const addons=(booking.addons||[]).length?` · Add-ons: ${booking.addons.join(', ')}`:'';
    card.querySelector('p').textContent=`${booking.notes?`Notes: ${booking.notes}`:'No notes'}${addons}`;
    container.appendChild(card);
  });
}

authForm.addEventListener('submit',async(event)=>{
 event.preventDefault();authError.textContent='';
 const email=authEmail.value.trim(),password=authPassword.value;
 if(authMode==='signup'){
  const phone=authPhone.value.trim();if(!phone){authError.textContent='Phone number is required.';return;}
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{phone}}});if(error){authError.textContent=error.message;return;}
  if(!data.session){authError.textContent='Account created. Check your email to confirm your account, then sign in.';return;}
  await sb.from('profiles').upsert({id:data.user.id,phone});await loadBookings(data.user);
 }else{
  const {data,error}=await sb.auth.signInWithPassword({email,password});if(error){authError.textContent='Wrong email or password.';return;}await loadBookings(data.user);
 }
});
document.getElementById('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();accountArea.hidden=true;authGate.hidden=false;authForm.reset();});
async function init(){const {data:{session}}=await sb.auth.getSession();if(session)await loadBookings(session.user);}init();
