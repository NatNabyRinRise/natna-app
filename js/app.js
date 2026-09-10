// ================= STATE =================
let guideItems = [
  'งดน้ำงดอาหาร 8 ชม.ก่อนนัด','พกผลตรวจเดิม (ถ้ามี)','พาญาติหรือผู้ดูแลไปด้วย',
  'พกแว่นตา / เครื่องช่วยฟัง','เตรียมคำถามที่จะถามหมอ','พกสมุดบันทึกอาการ'
];

function iso(y,m,d){ return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
const today = new Date(); today.setHours(0,0,0,0);

let appointments = [
  { id:crypto.randomUUID(), name:'คุณยายสมศรี ใจดี', place:'โรงพยาบาลศิริราช · แผนกอายุรกรรม', date:'2026-09-11', time:'09:30',
    checklist:[
      {id:crypto.randomUUID(), text:'พกบัตรประชาชน / บัตรโรงพยาบาล', done:false, source:'custom'},
      {id:crypto.randomUUID(), text:'พกยาที่กินอยู่ประจำ', done:false, source:'custom'}
    ] },
  { id:crypto.randomUUID(), name:'คุณตาประยุทธ์ มั่นคง', place:'โรงพยาบาลรามาธิบดี · แผนกหัวใจ', date:'2026-09-20', time:'13:00', checklist:[] },
  { id:crypto.randomUUID(), name:'คุณป้าวันเพ็ญ สุขใจ', place:'โรงพยาบาลจุฬาลงกรณ์ · แผนกตา', date:'2026-08-30', time:'10:15', checklist:[] },
  { id:crypto.randomUUID(), name:'คุณลุงสมชาย รุ่งเรือง', place:'โรงพยาบาลศิริราช · แผนกกระดูก', date:'2026-10-05', time:'14:30', checklist:[] }
];

let currentApptId = null;
let deleteTargetId = null;
let calMonth = today.getMonth();
let calYear = today.getFullYear();
let selectedCalDate = null;

// ตัวเลือกแจ้งเตือนล่วงหน้า (เลือกได้หลายอัน ไม่บังคับ)
const NOTIFY_OPTIONS = [
  { value:'7d', label:'1 สัปดาห์' },
  { value:'5d', label:'5 วัน' },
  { value:'3d', label:'3 วัน' },
  { value:'1d', label:'1 วัน' },
  { value:'3h', label:'3 ชม.' },
  { value:'1h', label:'1 ชม.' }
];
let selectedNotify = [];
let pendingAppt = null; // ข้อมูลนัดหมายที่กรอกไว้ รอตรวจสอบในหน้า Preview

// ================= NAV between top-level pages =================
function hideAllPages(){
  ['homePage','addPage','previewPage','detailPage','managePage'].forEach(id => document.getElementById(id).classList.add('hidden'));
}
function showHome(){
  hideAllPages();
  document.getElementById('homePage').classList.remove('hidden');
  renderCardView();
  renderCalendar();
}
function showAddForm(){
  hideAllPages();
  document.getElementById('addPage').classList.remove('hidden');
  document.getElementById('fName').value='';
  document.getElementById('fPlace').value='';
  document.getElementById('fDept').value='';
  document.getElementById('fDate').value='';
  document.getElementById('fHour').value='';
  document.getElementById('fMinute').value='';
  selectedNotify = [];
  renderNotifyChips();
}
function editAppointment(){
  // กลับไปหน้ากรอกข้อมูล โดยไม่ล้างข้อมูลที่กรอกไว้ (สำหรับปุ่ม "แก้ไข" จากหน้า Preview)
  hideAllPages();
  document.getElementById('addPage').classList.remove('hidden');
}
function showDetail(id){
  currentApptId = id;
  hideAllPages();
  document.getElementById('detailPage').classList.remove('hidden');
  renderDetail();
}
function showManage(){
  hideAllPages();
  document.getElementById('managePage').classList.remove('hidden');
  renderGuideManageList();
}

// ================= Status helper =================
function apptStatus(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((d - today) / 86400000);
  if(diffDays < 0) return { label:'หมดอายุ', cls:'expired', diffDays };
  if(diffDays <= 3) return { label: diffDays===0 ? 'วันนี้' : `ใกล้มาถึงอีก ${diffDays} วัน`, cls:'urgent', diffDays };
  return { label:`ใกล้มาถึงอีก ${diffDays} วัน`, cls:'upcoming', diffDays };
}
function fmtDateTh(dateStr){
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const [y,m,d] = dateStr.split('-').map(Number);
  return `${d} ${months[m-1]} ${y+543}`;
}

// ================= Card view =================
function renderCardView(){
  const el = document.getElementById('cardView');
  el.innerHTML = '';
  if(appointments.length === 0){
    el.innerHTML = '<div class="empty-state">ยังไม่มีนัดหมาย กด "+ เพิ่มนัด" เพื่อเริ่มต้น</div>';
    return;
  }
  const sorted = [...appointments].sort((a,b) => {
    const da = apptStatus(a.date).diffDays, db = apptStatus(b.date).diffDays;
    const aExpired = da < 0, bExpired = db < 0;
    if(aExpired !== bExpired) return aExpired ? 1 : -1; // นัดที่ยังไม่หมดอายุขึ้นก่อนเสมอ
    if(!aExpired) return da - db; // ใกล้ถึงที่สุดขึ้นก่อน
    return db - da; // หมดอายุ: เพิ่งผ่านไปหมาดๆ ขึ้นก่อน
  });
  sorted.forEach(appt => {
    const st = apptStatus(appt.date);
    const card = document.createElement('div');
    card.className = 'appt-card';
    card.innerHTML = `
      <div>
        <div class="appt-name">${appt.name}</div>
        <div class="appt-place">${appt.place}${appt.dept ? ' · ' + appt.dept : ''}</div>
        <div class="appt-date">${fmtDateTh(appt.date)} · ${appt.time} น.</div>
      </div>
      <div class="appt-right">
        <span class="badge badge-${st.cls}">${st.label}</span>
        <button class="trash-btn" title="ลบนัดหมาย">🗑</button>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if(e.target.closest('.trash-btn')) return;
      showDetail(appt.id);
    });
    card.querySelector('.trash-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      askDelete(appt.id);
    });
    el.appendChild(card);
  });
}

// ================= Delete confirm =================
function askDelete(id){
  deleteTargetId = id;
  document.getElementById('confirmModal').classList.remove('hidden');
}
function cancelDelete(){
  deleteTargetId = null;
  document.getElementById('confirmModal').classList.add('hidden');
}
function confirmDelete(){
  appointments = appointments.filter(a => a.id !== deleteTargetId);
  deleteTargetId = null;
  document.getElementById('confirmModal').classList.add('hidden');
  renderCardView();
  renderCalendar();
}

// ================= Add appointment =================
function populateTimeSelects(){
  const hourSel = document.getElementById('fHour');
  for(let h=0; h<24; h++){
    const v = String(h).padStart(2,'0');
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    hourSel.appendChild(opt);
  }
  const minSel = document.getElementById('fMinute');
  for(let m=0; m<60; m+=5){
    const v = String(m).padStart(2,'0');
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = v;
    minSel.appendChild(opt);
  }
}

function renderNotifyChips(){
  const el = document.getElementById('notifyChips');
  el.innerHTML = '';
  NOTIFY_OPTIONS.forEach(opt => {
    const chip = document.createElement('span');
    chip.className = 'notify-chip' + (selectedNotify.includes(opt.value) ? ' selected' : '');
    chip.textContent = opt.label;
    chip.addEventListener('click', () => {
      if(selectedNotify.includes(opt.value)) selectedNotify = selectedNotify.filter(v => v !== opt.value);
      else selectedNotify.push(opt.value);
      renderNotifyChips();
    });
    el.appendChild(chip);
  });
}

function goToPreview(){
  const name = document.getElementById('fName').value.trim();
  const place = document.getElementById('fPlace').value.trim();
  const dept = document.getElementById('fDept').value.trim();
  const date = document.getElementById('fDate').value;
  const hour = document.getElementById('fHour').value;
  const minute = document.getElementById('fMinute').value;
  if(!name || !place || !dept || !date || !hour || !minute){
    alert('กรุณากรอกข้อมูลให้ครบทุกช่องก่อนนะคะ (ยกเว้นช่องแจ้งเตือน)');
    return;
  }
  pendingAppt = { name, place, dept, date, time:`${hour}:${minute}`, notifications:[...selectedNotify] };
  renderPreview();
  hideAllPages();
  document.getElementById('previewPage').classList.remove('hidden');
}

function renderPreview(){
  document.getElementById('pName').textContent = pendingAppt.name;
  document.getElementById('pPlace').textContent = pendingAppt.place;
  document.getElementById('pDept').textContent = pendingAppt.dept;
  document.getElementById('pDate').textContent = fmtDateTh(pendingAppt.date);
  document.getElementById('pTime').textContent = `${pendingAppt.time} น.`;
  const labels = pendingAppt.notifications.map(v => NOTIFY_OPTIONS.find(o => o.value === v).label);
  document.getElementById('pNotify').textContent = labels.length ? `${labels.join(', ')} ก่อนนัด` : 'ไม่ได้ตั้งการแจ้งเตือน';
}

function confirmAppointment(){
  appointments.push({ id:crypto.randomUUID(), ...pendingAppt, checklist:[] });
  pendingAppt = null;
  showHome();
}

// ================= Home view toggle =================
function setHomeView(view){
  document.getElementById('btnCardView').classList.toggle('active', view==='card');
  document.getElementById('btnCalView').classList.toggle('active', view==='calendar');
  document.getElementById('cardView').classList.toggle('hidden', view!=='card');
  document.getElementById('calendarView').classList.toggle('hidden', view!=='calendar');
  if(view==='calendar') renderCalendar();
}

// ================= Calendar view =================
function changeMonth(delta){
  calMonth += delta;
  if(calMonth < 0){ calMonth = 11; calYear--; }
  if(calMonth > 11){ calMonth = 0; calYear++; }
  selectedCalDate = null;
  renderCalendar();
}
function renderCalendar(){
  const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  document.getElementById('calMonthLabel').textContent = `${monthNames[calMonth]} ${calYear+543}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  ['อา','จ','อ','พ','พฤ','ศ','ส'].forEach(w => {
    const wd = document.createElement('div');
    wd.className = 'cal-weekday'; wd.textContent = w;
    grid.appendChild(wd);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  for(let i=0;i<firstDay;i++){
    const empty = document.createElement('div');
    empty.className = 'cal-day empty-cell';
    grid.appendChild(empty);
  }

  for(let d=1; d<=daysInMonth; d++){
    const dateStr = iso(calYear, calMonth+1, d);
    const dayAppts = appointments.filter(a => a.date === dateStr);
    const cell = document.createElement('div');
    const statusCls = dayAppts.length ? apptStatus(dayAppts[0].date).cls : '';
    cell.className = 'cal-day' + (dayAppts.length ? ` has-appt cal-cell-${statusCls}` : '') + (selectedCalDate===dateStr ? ' selected' : '');
    cell.innerHTML = `<span>${d}</span>`;
    if(dayAppts.length){
      cell.addEventListener('click', () => { selectedCalDate = dateStr; renderCalendar(); renderCalDayList(dayAppts); });
    }
    grid.appendChild(cell);
  }

  if(selectedCalDate){
    const dayAppts = appointments.filter(a => a.date === selectedCalDate);
    if(dayAppts.length) renderCalDayList(dayAppts); else document.getElementById('calDayList').innerHTML='';
  } else {
    document.getElementById('calDayList').innerHTML = '<p class="empty-note">แตะวันที่มีจุดสีเพื่อดูนัดหมาย</p>';
  }
}
function renderCalDayList(dayAppts){
  const el = document.getElementById('calDayList');
  el.innerHTML = '';
  dayAppts.forEach(appt => {
    const st = apptStatus(appt.date);
    const card = document.createElement('div');
    card.className = 'appt-card';
    card.innerHTML = `
      <div>
        <div class="appt-name">${appt.name}</div>
        <div class="appt-place">${appt.place}${appt.dept ? ' · ' + appt.dept : ''}</div>
        <div class="appt-date">${fmtDateTh(appt.date)} · ${appt.time} น.</div>
      </div>
      <div class="appt-right"><span class="badge badge-${st.cls}">${st.label}</span></div>
    `;
    card.addEventListener('click', () => showDetail(appt.id));
    el.appendChild(card);
  });
}

// ================= Detail page (checklist) =================
function currentAppt(){ return appointments.find(a => a.id === currentApptId); }

function renderDetail(){
  const appt = currentAppt();
  document.getElementById('dName').textContent = appt.name;
  document.getElementById('dPlace').textContent = appt.place + (appt.dept ? ' · ' + appt.dept : '');
  document.getElementById('dTime').textContent = `${fmtDateTh(appt.date)} · ${appt.time} น.`;
  renderChecklist();
  renderSuggestChips();
}

function renderChecklist(){
  const appt = currentAppt();
  const checklistEl = document.getElementById('checklist');
  checklistEl.innerHTML = '';
  appt.checklist.forEach(item => {
    const li = document.createElement('li');
    li.className = 'check-item' + (item.done ? ' done' : '');
    li.innerHTML = `
      <div class="check-box"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7l3.5 3.5L12 3" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <span class="check-label" contenteditable="true">${item.text}</span>
      <button class="item-btn" title="ลบ">✕</button>
    `;
    li.querySelector('.check-box').addEventListener('click', () => {
      item.done = !item.done; li.classList.toggle('done'); updateStatus();
    });
    li.querySelector('.check-label').addEventListener('input', e => { item.text = e.target.textContent; });
    li.querySelector('.item-btn').addEventListener('click', () => {
      if(item.source === 'guide' && !guideItems.includes(item.text)) guideItems.push(item.text);
      appt.checklist = appt.checklist.filter(i => i.id !== item.id);
      renderChecklist(); renderSuggestChips();
    });
    checklistEl.appendChild(li);
  });
  updateStatus();
}

function renderSuggestChips(){
  const el = document.getElementById('suggestChips');
  el.innerHTML = '';
  if(guideItems.length === 0){
    el.innerHTML = '<span class="empty-note">ยังไม่มีรายการแนะนำ ลองเพิ่มได้ที่หน้าจัดการ</span>';
    return;
  }
  guideItems.forEach(text => {
    const chip = document.createElement('span');
    chip.className = 'chip'; chip.textContent = text;
    chip.addEventListener('click', () => {
      const appt = currentAppt();
      appt.checklist.push({ id:crypto.randomUUID(), text, done:false, source:'guide' });
      guideItems = guideItems.filter(g => g !== text);
      renderChecklist(); renderSuggestChips();
    });
    el.appendChild(chip);
  });
}

function addCustomItem(){
  const input = document.getElementById('newItem');
  const text = input.value.trim();
  if(!text) return;
  currentAppt().checklist.push({ id:crypto.randomUUID(), text, done:false, source:'custom' });
  input.value = '';
  renderChecklist();
}
document.getElementById('newItem').addEventListener('keypress', e => { if(e.key==='Enter') addCustomItem(); });

function updateStatus(){
  const appt = currentAppt();
  const total = appt.checklist.length;
  const done = appt.checklist.filter(i => i.done).length;
  const pill = document.getElementById('statusPill');
  if(total > 0 && done === total){ pill.textContent='พร้อมแล้ว'; pill.className='status-pill status-ready'; }
  else { pill.textContent='ยังไม่พร้อม'; pill.className='status-pill status-notready'; }
}

// ================= Manage guide list =================
function renderGuideManageList(){
  const el = document.getElementById('guideManageList');
  el.innerHTML = '';
  if(guideItems.length === 0){ el.innerHTML = '<p class="empty-note">ยังไม่มีรายการแนะนำ</p>'; return; }
  guideItems.forEach(text => {
    const row = document.createElement('div');
    row.className = 'guide-row';
    row.innerHTML = `<span style="flex:1;">${text}</span><button class="item-btn" title="ลบ">✕</button>`;
    row.querySelector('.item-btn').addEventListener('click', () => {
      guideItems = guideItems.filter(g => g !== text);
      renderGuideManageList();
    });
    el.appendChild(row);
  });
}
function addGuideItem(){
  const input = document.getElementById('newGuideItem');
  const text = input.value.trim();
  if(!text) return;
  guideItems.push(text);
  input.value = '';
  renderGuideManageList();
}
document.getElementById('newGuideItem').addEventListener('keypress', e => { if(e.key==='Enter') addGuideItem(); });

// ================= init =================
// เปิดใช้งานสถานะ :active (สีเปลี่ยนตอนกด) บน iOS Safari ซึ่งปกติต้องมี touch listener
// อยู่บนหน้าก่อนถึงจะยอม trigger :active ให้ - จำเป็นเพราะกลุ่มเป้าหมายเป็นผู้สูงอายุ
// ที่ใช้นิ้วแตะและต้องเห็น feedback ทางสีชัดเจนว่ากดโดนแล้ว
document.addEventListener('touchstart', function(){}, { passive:true });

populateTimeSelects();
renderNotifyChips();
showHome();
