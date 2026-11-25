import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const env = import.meta.env;
const supabase = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;
const grid = document.querySelector('#calendar-grid');
const heroMonth = document.querySelector('#hero-month');
const monthLockup = document.querySelector('.month-lockup');
const yearStack = document.querySelector('.year-stack');
const heroYearTop = document.querySelector('#hero-year-top');
const heroYearBottom = document.querySelector('#hero-year-bottom');
const selectedDateLabel = document.querySelector('#selected-date');
const entryDialog = document.querySelector('#entry-dialog');
const deleteConfirm = document.querySelector('#delete-confirm');
const noteInput = document.querySelector('#note-input');
const saveButton = document.querySelector('#save-entry');
const deleteButton = document.querySelector('#delete-entry');
const countLabel = document.querySelector('#month-count');
const charCount = document.querySelector('#char-count');
const storageKey = 'exit-diary.entries.v1';
const accountButton = document.querySelector('#account-button');
const accountDialog = document.querySelector('#account-dialog');
const accountStatus = document.querySelector('#account-status');
const authError = document.querySelector('#auth-error');
const appToast = document.querySelector('#app-toast');
const googleLogin = document.querySelector('#google-login');
const appleLogin = document.querySelector('#apple-login');
const signOutButton = document.querySelector('#sign-out');
const deleteAccountButton = document.querySelector('#delete-account');
const monthNames = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const monthThemes = [
  {ink:'#235b43',line:'#37634e',accent:'#235b43'},
  {ink:'#526986',line:'#657b9a',accent:'#526986'},
  {ink:'#9c82b1',line:'#ad97be',accent:'#9c82b1'},
  {ink:'#4d986e',line:'#5aa67a',accent:'#4d986e'},
  {ink:'#c95f83',line:'#d77996',accent:'#c95f83'},
  {ink:'#bb8b16',line:'#c99a26',accent:'#c28f0e'},
  {ink:'#e87532',line:'#e98b51',accent:'#e87532'},
  {ink:'#8f315f',line:'#a54873',accent:'#8f315f'},
  {ink:'#9d8b6e',line:'#b1a086',accent:'#9d8b6e'},
  {ink:'#a96e35',line:'#bd8248',accent:'#a96e35'},
  {ink:'#394442',line:'#4d5a57',accent:'#394442'},
  {ink:'#287aa6',line:'#428fb8',accent:'#287aa6'}
];
let currentUser = null;
let entries = readEntries(storageKey);
const now = new Date();
let shownMonth = new Date(now.getFullYear(), now.getMonth(), 1);
let selectedKey = null;
let selectedColor = '#d98270';

function readEntries(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); }
  catch { return {}; }
}
function cacheKey() { return currentUser ? `${storageKey}:${currentUser.id}` : storageKey; }
function cacheEntries() { localStorage.setItem(cacheKey(), JSON.stringify(entries)); }
function pendingKey(userId) { return `${storageKey}:${userId}:pending`; }
function readPending(userId) {
  try { return JSON.parse(localStorage.getItem(pendingKey(userId)) || '{}'); }
  catch { return {}; }
}
function writePending(userId, pending) {
  localStorage.setItem(pendingKey(userId), JSON.stringify(pending));
}
function reportAuthError(message) {
  authError.textContent = message;
  authError.hidden = !message;
}
function reportSyncError(message) {
  appToast.textContent = message;
  appToast.hidden = false;
  clearTimeout(reportSyncError.timeout);
  reportSyncError.timeout = setTimeout(() => { appToast.hidden = true; }, 5000);
}
async function loadUserEntries(user) {
  if (!supabase || !user) return;
  const userCacheKey = `${storageKey}:${user.id}`;
  const localEntries = readEntries(userCacheKey);
  const pending = readPending(user.id);
  const { data, error } = await supabase.from('diary_entries')
    .select('entry_date,note,color').eq('user_id', user.id);
  if (error) throw error;
  const existingCloudEntries = Object.fromEntries(data.map((entry) => [entry.entry_date, {
    note: entry.note,
    color: entry.color
  }]));
  const toMigrate = Object.entries(readEntries(storageKey))
    .filter(([date]) => !existingCloudEntries[date])
    .map(([date, entry]) => ({
      user_id: user.id,
      entry_date: date,
      note: entry.note || '',
      color: entry.color
    }));
  if (toMigrate.length) {
    const { error: migrateError } = await supabase.from('diary_entries').upsert(toMigrate, {
      onConflict: 'user_id,entry_date',
      ignoreDuplicates: true
    });
    if (migrateError) throw migrateError;
    const { data: refreshed, error: refreshError } = await supabase.from('diary_entries')
      .select('entry_date,note,color').eq('user_id', user.id);
    if (refreshError) throw refreshError;
    data.splice(0, data.length, ...refreshed);
  }
  let pendingChanged = false;
  for (const [date, action] of Object.entries(pending)) {
    const result = action === 'delete'
      ? await supabase.from('diary_entries').delete().eq('user_id', user.id).eq('entry_date', date)
      : await supabase.from('diary_entries').upsert({
        user_id: user.id, entry_date: date, ...localEntries[date],
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,entry_date' });
    if (!result.error) { delete pending[date]; pendingChanged = true; }
  }
  if (pendingChanged) writePending(user.id, pending);
  const { data: latest, error: latestError } = await supabase.from('diary_entries')
    .select('entry_date,note,color').eq('user_id', user.id);
  if (latestError) throw latestError;
  if (currentUser?.id !== user.id) return;
  const cloudEntries = Object.fromEntries(latest.map((entry) => [entry.entry_date, {
    note: entry.note,
    color: entry.color
  }]));
  entries = { ...localEntries, ...cloudEntries };
  for (const [date, action] of Object.entries(pending)) {
    if (action === 'delete') delete entries[date];
    else if (localEntries[date]) entries[date] = localEntries[date];
  }
  localStorage.setItem(userCacheKey, JSON.stringify(entries));
  renderCalendar();
}
async function handleAuthState(session) {
  const nextUser = session?.user || null;
  if (nextUser?.id === currentUser?.id) return;
  currentUser = nextUser;
  accountButton.textContent = currentUser ? '계정' : '로그인';
  googleLogin.hidden = Boolean(currentUser);
  appleLogin.hidden = Boolean(currentUser);
  signOutButton.hidden = !currentUser;
  deleteAccountButton.hidden = !currentUser;
  accountStatus.textContent = currentUser?.email || '로그인하면 기록을 여러 기기에서 동기화할 수 있어요.';
  entries = currentUser ? readEntries(`${storageKey}:${currentUser.id}`) : readEntries(storageKey);
  renderCalendar();
  if (currentUser) {
    try { await loadUserEntries(currentUser); }
    catch (error) { reportSyncError(`기록을 불러오지 못했어요: ${error.message}`); }
  }
}
async function signIn(provider) {
  if (!supabase) {
    reportAuthError('서버 설정이 필요해요. .env에 Supabase URL과 키를 입력해 주세요.');
    return;
  }
  reportAuthError('');
  const native = Capacitor.isNativePlatform();
  const redirectTo = native ? 'exitdiary://auth/callback' : `${location.origin}${location.pathname}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: native }
  });
  if (error) { reportAuthError(error.message); return; }
  if (native && data.url) await Browser.open({ url: data.url });
}
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    void handleAuthState(session);
  });
  supabase.auth.getSession().then(({ data }) => handleAuthState(data.session));
}
if (Capacitor.isNativePlatform()) {
  App.addListener('appUrlOpen', async ({ url }) => {
    const code = new URL(url).searchParams.get('code');
    if (!code || !supabase) return;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    await Browser.close();
    if (error) reportAuthError(error.message);
  });
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function fitMonthTitle() {
  const canvas = fitMonthTitle.canvas || (fitMonthTitle.canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  const style = getComputedStyle(heroMonth);
  const probeSize = 100;
  context.font = `${style.fontStyle} ${style.fontWeight} ${probeSize}px ${style.fontFamily}`;
  const textWidth = context.measureText(heroMonth.textContent).width;
  const gap = parseFloat(getComputedStyle(monthLockup).gap) || 0;
  const width = monthLockup.clientWidth - yearStack.getBoundingClientRect().width - gap;
  const maxSize = matchMedia('(max-width: 680px)').matches ? 122 : 260;
  heroMonth.style.fontSize = `${Math.max(36, Math.min(maxSize, width / textWidth * probeSize))}px`;
}
function renderCalendar() {
  const year = shownMonth.getFullYear();
  const month = shownMonth.getMonth();
  const theme = monthThemes[month];
  document.documentElement.dataset.monthTheme = month;
  document.documentElement.style.setProperty('--navy', theme.ink);
  document.documentElement.style.setProperty('--rule', theme.line);
  document.documentElement.style.setProperty('--orange', theme.accent);
  document.documentElement.style.backgroundColor = theme.ink;
  document.body.style.backgroundColor = theme.ink;
  document.querySelector('meta[name="theme-color"]').content = theme.ink;
  heroMonth.textContent = monthNames[month];
  heroYearTop.textContent = String(year).slice(0, 2);
  heroYearBottom.textContent = String(year).slice(2);
  requestAnimationFrame(fitMonthTitle);
  grid.replaceChildren();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  for (let i=0;i<totalCells;i++) {
    const day = i-firstWeekday+1;
    const cell = document.createElement('button');
    cell.type='button'; cell.className='day-cell'; cell.setAttribute('role','gridcell');
    if (day < 1 || day > daysInMonth) {
      cell.classList.add('outside'); cell.disabled=true; cell.setAttribute('aria-hidden','true');
      const outsideDay = day < 1 ? new Date(year, month, day).getDate() : day - daysInMonth;
      const number=document.createElement('span');number.className='day-number';number.textContent=outsideDay;cell.append(number);
    }
    else {
      const date = new Date(year, month, day); const key = dateKey(date); const entry = entries[key];
      if (entry) cell.classList.add('has-entry');
      cell.dataset.date=key; cell.setAttribute('aria-label', `${month+1}월 ${day}일${entry ? ', 기록 있음' : ''}`);
      if (dateKey(date)===dateKey(now)) cell.classList.add('today');
      if (key===selectedKey) cell.classList.add('selected-day');
      const number=document.createElement('span');number.className='day-number';number.textContent=day;cell.append(number);
      if(entry){const dot=document.createElement('i');dot.className='day-dot';dot.style.backgroundColor=entry.color;cell.append(dot);}
      cell.addEventListener('click',()=>selectDate(key));
    }
    grid.append(cell);
  }
  const count=Object.keys(entries).filter(key=>key.startsWith(`${year}-${String(month+1).padStart(2,'0')}-`)).length;
  countLabel.textContent=count ? `${count}일 기록` : '';
}
function selectDate(key) {
  selectedKey=key;
  const [year,month,day]=key.split('-').map(Number);
  selectedDateLabel.textContent=`${year}년 ${month}월 ${day}일`;
  const entry=entries[key];
  noteInput.disabled=false; noteInput.value=entry?.note || ''; selectedColor=entry?.color || monthThemes[shownMonth.getMonth()].accent;
  charCount.textContent=`${noteInput.value.length} / 240`;
  saveButton.disabled=false; deleteButton.hidden=!entry;
  document.querySelectorAll('.color-option').forEach(button=>{
    const active=button.dataset.color===selectedColor;button.classList.toggle('selected',active);button.setAttribute('aria-checked',String(active));
  });
  grid.querySelectorAll('.day-cell').forEach(cell=>cell.classList.toggle('selected-day',cell.dataset.date===key));
  entryDialog.showModal();
  noteInput.focus();
}
document.querySelector('#prev-month').addEventListener('click',()=>{shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()-1,1);renderCalendar();});
document.querySelector('#next-month').addEventListener('click',()=>{shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()+1,1);renderCalendar();});
accountButton.addEventListener('click', () => {
  reportAuthError('');
  if (!supabase) reportAuthError('서버 설정이 필요해요. .env에 Supabase URL과 키를 입력해 주세요.');
  accountDialog.showModal();
});
document.querySelector('#close-account').addEventListener('click', () => accountDialog.close());
googleLogin.addEventListener('click', () => void signIn('google'));
appleLogin.addEventListener('click', () => void signIn('apple'));
signOutButton.addEventListener('click', async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) reportAuthError(error.message);
  else accountDialog.close();
});
deleteAccountButton.addEventListener('click', async () => {
  if (!supabase || !currentUser) return;
  if (!window.confirm('계정과 서버에 저장된 모든 기록을 삭제할까요? 이 작업은 되돌릴 수 없어요.')) return;
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) { reportAuthError(`계정을 삭제하지 못했어요: ${error.message}`); return; }
  localStorage.removeItem(`${storageKey}:${currentUser.id}`);
  localStorage.removeItem(pendingKey(currentUser.id));
  await supabase.auth.signOut();
  accountDialog.close();
});
document.querySelectorAll('.color-option').forEach(button=>button.addEventListener('click',()=>{
  selectedColor=button.dataset.color;
  document.querySelectorAll('.color-option').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-checked',String(active));});
}));
noteInput.addEventListener('input',()=>{charCount.textContent=`${noteInput.value.length} / 240`;});
document.querySelector('#close-dialog').addEventListener('click',()=>entryDialog.close());
entryDialog.addEventListener('click',(event)=>{if(event.target===entryDialog)entryDialog.close();});
document.querySelector('#cancel-delete').addEventListener('click',()=>deleteConfirm.close());
deleteConfirm.addEventListener('click',(event)=>{if(event.target===deleteConfirm)deleteConfirm.close();});
saveButton.addEventListener('click',async ()=>{
  const note=noteInput.value.trim();
  entries[selectedKey]={note,color:selectedColor};
  cacheEntries();
  renderCalendar();
  if (supabase && currentUser) {
    const { error } = await supabase.from('diary_entries').upsert({
      user_id: currentUser.id,
      entry_date: selectedKey,
      note,
      color: selectedColor,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,entry_date' });
    if (error) {
      const pending = readPending(currentUser.id); pending[selectedKey] = 'upsert'; writePending(currentUser.id, pending);
      reportSyncError(`서버에 저장하지 못했어요. 연결되면 다시 동기화할게요.`);
    } else {
      const pending = readPending(currentUser.id); delete pending[selectedKey]; writePending(currentUser.id, pending);
    }
  }
  entryDialog.close();
});
deleteButton.addEventListener('click',()=>deleteConfirm.showModal());
document.querySelector('#confirm-delete').addEventListener('click',async ()=>{
  delete entries[selectedKey];cacheEntries();
  if (supabase && currentUser) {
    const { error } = await supabase.from('diary_entries').delete()
      .eq('user_id', currentUser.id).eq('entry_date', selectedKey);
    if (error) {
      const pending = readPending(currentUser.id); pending[selectedKey] = 'delete'; writePending(currentUser.id, pending);
      reportSyncError('서버에서 삭제하지 못했어요. 연결되면 다시 동기화할게요.');
    } else {
      const pending = readPending(currentUser.id); delete pending[selectedKey]; writePending(currentUser.id, pending);
    }
  }
  noteInput.value='';charCount.textContent='0 / 240';deleteButton.hidden=true;renderCalendar();
  deleteConfirm.close();
  entryDialog.close();
});
renderCalendar();
window.addEventListener('resize',fitMonthTitle);
if (document.fonts?.ready) document.fonts.ready.then(fitMonthTitle);
window.addEventListener('online', () => {
  if (currentUser) loadUserEntries(currentUser).catch((error) => {
    reportSyncError(`기록을 동기화하지 못했어요: ${error.message}`);
  });
});
