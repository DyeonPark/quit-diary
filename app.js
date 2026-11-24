const grid = document.querySelector('#calendar-grid');
const monthLabel = document.querySelector('#month-label');
const selectedDateLabel = document.querySelector('#selected-date');
const noteInput = document.querySelector('#note-input');
const saveButton = document.querySelector('#save-entry');
const deleteButton = document.querySelector('#delete-entry');
const countLabel = document.querySelector('#month-count');
const charCount = document.querySelector('#char-count');
const saveHint = document.querySelector('#save-hint');
const storageKey = 'exit-diary.entries.v1';
let entries = readEntries();
const now = new Date();
let shownMonth = new Date(now.getFullYear(), now.getMonth(), 1);
let selectedKey = dateKey(now);
let selectedColor = '#d98270';

function readEntries() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
  catch { return {}; }
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function renderCalendar() {
  const year = shownMonth.getFullYear();
  const month = shownMonth.getMonth();
  monthLabel.textContent = `${year}년 ${month+1}월`;
  grid.replaceChildren();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  for (let i=0;i<totalCells;i++) {
    const day = i-firstWeekday+1;
    const cell = document.createElement('button');
    cell.type='button'; cell.className='day-cell'; cell.setAttribute('role','gridcell');
    if (day < 1 || day > daysInMonth) { cell.classList.add('outside'); cell.disabled=true; cell.setAttribute('aria-hidden','true'); }
    else {
      const date = new Date(year, month, day); const key = dateKey(date); const entry = entries[key];
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
  noteInput.disabled=false; noteInput.value=entry?.note || ''; selectedColor=entry?.color || '#d98270';
  charCount.textContent=`${noteInput.value.length} / 240`;
  saveButton.disabled=false; deleteButton.disabled=!entry;
  saveHint.textContent=entry ? '기록을 수정할 수 있어요.' : '점과 메모를 남겨보세요.';
  document.querySelectorAll('.color-option').forEach(button=>{
    const active=button.dataset.color===selectedColor;button.classList.toggle('selected',active);button.setAttribute('aria-checked',String(active));
  });
  renderCalendar();
}
document.querySelector('#prev-month').addEventListener('click',()=>{shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()-1,1);renderCalendar();});
document.querySelector('#next-month').addEventListener('click',()=>{shownMonth=new Date(shownMonth.getFullYear(),shownMonth.getMonth()+1,1);renderCalendar();});
document.querySelectorAll('.color-option').forEach(button=>button.addEventListener('click',()=>{
  selectedColor=button.dataset.color;
  document.querySelectorAll('.color-option').forEach(item=>{const active=item===button;item.classList.toggle('selected',active);item.setAttribute('aria-checked',String(active));});
}));
noteInput.addEventListener('input',()=>{charCount.textContent=`${noteInput.value.length} / 240`;});
saveButton.addEventListener('click',()=>{
  const note=noteInput.value.trim();
  entries[selectedKey]={note,color:selectedColor};
  localStorage.setItem(storageKey,JSON.stringify(entries));
  deleteButton.disabled=false;saveHint.textContent=note?'오늘의 마음을 기록했어요.':'오늘의 점을 남겼어요.';
  renderCalendar();
});
deleteButton.addEventListener('click',()=>{
  delete entries[selectedKey];localStorage.setItem(storageKey,JSON.stringify(entries));
  noteInput.value='';charCount.textContent='0 / 240';deleteButton.disabled=true;saveHint.textContent='기록을 지웠어요.';renderCalendar();
});
renderCalendar();selectDate(selectedKey);
