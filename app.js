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
let entries = readEntries();
const now = new Date();
let shownMonth = new Date(now.getFullYear(), now.getMonth(), 1);
let selectedKey = null;
let selectedColor = '#d98270';

function readEntries() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
  catch { return {}; }
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
document.querySelectorAll('.color-option').forEach(button=>button.addEventListener('click',()=>{
  selectedColor=button.dataset.color;
  document.querySelectorAll('.color-option').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-checked',String(active));});
}));
noteInput.addEventListener('input',()=>{charCount.textContent=`${noteInput.value.length} / 240`;});
document.querySelector('#close-dialog').addEventListener('click',()=>entryDialog.close());
entryDialog.addEventListener('click',(event)=>{if(event.target===entryDialog)entryDialog.close();});
document.querySelector('#cancel-delete').addEventListener('click',()=>deleteConfirm.close());
deleteConfirm.addEventListener('click',(event)=>{if(event.target===deleteConfirm)deleteConfirm.close();});
saveButton.addEventListener('click',()=>{
  const note=noteInput.value.trim();
  entries[selectedKey]={note,color:selectedColor};
  localStorage.setItem(storageKey,JSON.stringify(entries));
  renderCalendar();
  entryDialog.close();
});
deleteButton.addEventListener('click',()=>deleteConfirm.showModal());
document.querySelector('#confirm-delete').addEventListener('click',()=>{
  delete entries[selectedKey];localStorage.setItem(storageKey,JSON.stringify(entries));
  noteInput.value='';charCount.textContent='0 / 240';deleteButton.hidden=true;renderCalendar();
  deleteConfirm.close();
  entryDialog.close();
});
renderCalendar();
window.addEventListener('resize',fitMonthTitle);
if (document.fonts?.ready) document.fonts.ready.then(fitMonthTitle);
