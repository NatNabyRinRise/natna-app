// ================= STATE =================
// guideItems คือ "ต้นแบบ" (template) ของรายการแนะนำ/เช็คลิสต์เริ่มต้น — ใช้ร่วมกันทุกนัดหมาย
// การเลือก/ลบรายการแนะนำในนัดหมายหนึ่งๆ ต้อง "ไม่" ไปแก้ไขอาเรย์นี้เด็ดขาด (ดูฟังก์ชัน
// renderSuggestChips / renderAddSuggestChips) มิเช่นนั้นรายการจะหายไปจากนัดหมายอื่นด้วย
let guideItems = [
  'บัตรประจำตัวประชาชน','บัตรสิทธิการรักษา','ผลตรวจเดิม/ใบส่งตัว',
  'งดน้ำงดอาหาร 8 ชั่วโมงก่อนนัด','พกแว่นตา/เครื่องช่วยฟัง','แจ้งญาติที่จะไปด้วย',
  'คำถามที่จะถามหมอ','ยา/ภาพฉลากยาที่รับประทาน'
];

function iso(y,m,d){ return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
const today = new Date(); today.setHours(0,0,0,0);

let appointments = [
  { id:crypto.randomUUID(), name:'คุณยายสมศรี ใจดี', place:'โรงพยาบาลศิริราช', dept:'แผนกอายุรกรรม', date:'2026-09-11', time:'09:30',
    checklist:[
      {id:crypto.randomUUID(), text:'พกบัตรประชาชน / บัตรโรงพยาบาล', done:false, source:'custom'},
      {id:crypto.randomUUID(), text:'พกยาที่กินอยู่ประจำ', done:false, source:'custom'}
    ] },
  { id:crypto.randomUUID(), name:'คุณตาประยุทธ์ มั่นคง', place:'โรงพยาบาลรามาธิบดี', dept:'แผนกหัวใจ', date:'2026-09-20', time:'13:00', checklist:[] },
  { id:crypto.randomUUID(), name:'คุณป้าวันเพ็ญ สุขใจ', place:'โรงพยาบาลจุฬาลงกรณ์', dept:'แผนกตา', date:'2026-08-30', time:'10:15', checklist:[] },
  { id:crypto.randomUUID(), name:'คุณลุงสมชาย รุ่งเรือง', place:'โรงพยาบาลศิริราช', dept:'แผนกกระดูก', date:'2026-10-05', time:'14:30', checklist:[] }
];

// ================= Persistence (localStorage) =================
// บันทึก/โหลด appointments (รวมเช็คลิสต์ของแต่ละนัด) และ guideItems (รายการแนะนำ/default checklist)
// ทุกครั้งที่มีการเพิ่ม/แก้ไข/ลบ ให้เรียก saveData() ต่อท้าย — ถ้ายังไม่เคยบันทึกไว้เลย (ใช้งานครั้งแรก)
// loadData() จะคืนค่า false แล้วปล่อยให้ข้อมูลตัวอย่างเริ่มต้นด้านบนนี้ใช้งานต่อไปตามเดิม
const STORAGE_KEY = 'natna_data_v1';

function saveData(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appointments, guideItems }));
  } catch(e) {
    console.error('บันทึกข้อมูลลง localStorage ไม่สำเร็จ', e);
  }
}

function loadData(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false; // ยังไม่เคยบันทึกไว้ (ใช้งานครั้งแรก) -> ใช้ข้อมูลตัวอย่างเริ่มต้น
    const data = JSON.parse(raw);
    if(data && Array.isArray(data.appointments) && Array.isArray(data.guideItems)){
      appointments = data.appointments;
      guideItems = data.guideItems;
      return true;
    }
  } catch(e) {
    console.error('โหลดข้อมูลที่บันทึกไว้ไม่สำเร็จ ใช้ข้อมูลตัวอย่างเริ่มต้นแทน', e);
  }
  return false;
}

loadData(); // โหลดข้อมูลที่เคยบันทึกไว้ทับข้อมูลตัวอย่างเริ่มต้นด้านบน (ถ้ามี)

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
let editingApptId = null; // ถ้าไม่ใช่ null แปลว่ากำลังแก้ไขนัดหมายเดิม (ไม่ใช่เพิ่มใหม่)
let pendingChecklist = []; // เช็คลิสต์ที่กรอกไว้ในหน้าเพิ่ม/แก้ไขนัด (ยังไม่บันทึกจริงจนกว่าจะกดยืนยัน)

// ไอคอนแทนสถานะนัดหมาย (ใช้ทั้งหน้าแรกและหน้าปฏิทิน)
// กฎ: วันนี้ = หมอ, น้อยกว่า 3 วัน (ไม่ใช่วันนี้) = ไฟ, ไกลกว่านั้นหรือหมดอายุแล้ว = น้ำแข็ง
const STATUS_ICONS = { doctor:'👨‍⚕️', fire:'🔥', ice:'🧊' };
function statusIconKey(diffDays){
  if(diffDays === 0) return 'doctor';
  if(diffDays > 0 && diffDays < 3) return 'fire';
  return 'ice';
}

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
  editingApptId = null;
  hideAllPages();
  document.getElementById('addPage').classList.remove('hidden');
  document.getElementById('addPageTitle').textContent = 'เพิ่มนัดหมายใหม่';
  document.getElementById('fName').value='';
  document.getElementById('fPlace').value='';
  document.getElementById('fDept').value='';
  document.getElementById('fDate').value='';
  document.getElementById('fHour').value='';
  document.getElementById('fMinute').value='';
  selectedNotify = [];
  renderNotifyChips();
  // เริ่มเช็คลิสต์ด้วยรายการแนะนำ (default) ทั้งหมดโดยอัตโนมัติ ไม่ต้องแตะเพิ่มเอง
  // เป็นสำเนาแยกต่างหาก ไม่ใช่ reference กับ guideItems จึงลบ/แก้ในนัดนี้ได้โดยไม่กระทบต้นแบบ
  pendingChecklist = guideItems.map(text => ({ id:crypto.randomUUID(), text, done:false, source:'guide' }));
  renderPendingChecklist();
  renderAddSuggestChips();
}
function editApptFromList(id){
  // เปิดฟอร์มเดิม พร้อมข้อมูลนัดหมายที่มีอยู่แล้ว สำหรับปุ่ม "แก้ไข" ในรายการหน้าปฏิทิน
  const appt = appointments.find(a => a.id === id);
  if(!appt) return;
  editingApptId = id;
  hideAllPages();
  document.getElementById('addPage').classList.remove('hidden');
  document.getElementById('addPageTitle').textContent = 'แก้ไขนัดหมาย';
  document.getElementById('fName').value = appt.name;
  document.getElementById('fPlace').value = appt.place;
  document.getElementById('fDept').value = appt.dept || '';
  document.getElementById('fDate').value = appt.date;
  const [h, m] = appt.time.split(':');
  document.getElementById('fHour').value = h;
  document.getElementById('fMinute').value = m;
  selectedNotify = appt.notifications ? [...appt.notifications] : [];
  renderNotifyChips();
  pendingChecklist = appt.checklist ? appt.checklist.map(item => ({...item})) : [];
  renderPendingChecklist();
  renderAddSuggestChips();
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
    const iconKey = statusIconKey(st.diffDays);
    const card = document.createElement('div');
    card.className = 'appt-card';
    card.innerHTML = `
      <div class="status-icon status-icon-${iconKey}" title="${st.label}">${STATUS_ICONS[iconKey]}</div>
      <div class="appt-info">
        <div class="appt-name">${appt.name}</div>
        <div class="appt-place">${appt.place}${appt.dept ? ' · ' + appt.dept : ''}</div>
        <div class="appt-date">${fmtDateTh(appt.date)} · ${appt.time} น.</div>
      </div>
      <div class="appt-right">
        <span class="badge badge-${st.cls}">${st.label}</span>
        <div class="row-actions">
          <button class="edit-btn" title="แก้ไข">✏️</button>
          <button class="trash-btn" title="ลบนัดหมาย">🗑</button>
        </div>
      </div>
    `;
    // แตะที่ไหนของการ์ดก็ได้ (รวมปุ่มแก้ไข) ให้ไปหน้าแก้ไขนัดหมายเหมือนกันหมด
    // มีแค่ปุ่มลบเท่านั้นที่แยกออกไปทำงานของตัวเอง (เด้ง popup ยืนยันก่อนลบ)
    card.addEventListener('click', (e) => {
      if(e.target.closest('.trash-btn')) return;
      editApptFromList(appt.id);
    });
    card.querySelector('.trash-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      askDelete(appt.id);
    });
    el.appendChild(card);
  });
}

// ================= Upcoming appointments popup (เด้งอัตโนมัติตอนเปิดแอป) =================
function checkUpcomingPopup(){
  const upcoming = appointments
    .filter(a => { const d = apptStatus(a.date).diffDays; return d >= 0 && d < 5; })
    .sort((a,b) => apptStatus(a.date).diffDays - apptStatus(b.date).diffDays);
  if(upcoming.length === 0) return; // ไม่มีนัดแบบนี้ ไม่ต้องขึ้น pop-up

  const el = document.getElementById('upcomingModalList');
  el.innerHTML = '';
  upcoming.forEach(appt => {
    const st = apptStatus(appt.date);
    const iconKey = statusIconKey(st.diffDays);
    const card = document.createElement('div');
    card.className = 'appt-card cal-appt-row';
    card.innerHTML = `
      <div class="status-icon status-icon-${iconKey}" title="${st.label}">${STATUS_ICONS[iconKey]}</div>
      <div class="appt-info">
        <div class="appt-name">${appt.name}</div>
        <div class="appt-place">${appt.place}${appt.dept ? ' · ' + appt.dept : ''}</div>
        <div class="appt-date">${fmtDateTh(appt.date)} · ${appt.time} น.</div>
      </div>
    `;
    // แตะการ์ดใน pop-up ให้ไปหน้าแก้ไขนัดหมาย เหมือนกับปุ่ม "แก้ไข" ในการ์ดหน้าแรก/ปฏิทิน
    card.addEventListener('click', () => { closeUpcomingPopup(); editApptFromList(appt.id); });
    el.appendChild(card);
  });
  document.getElementById('upcomingModal').classList.remove('hidden');
}
function closeUpcomingPopup(){
  document.getElementById('upcomingModal').classList.add('hidden');
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
  saveData();
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

// เช็คลิสต์เตรียมตัวที่กรอกในหน้าเพิ่ม/แก้ไขนัด (ก่อนบันทึกจริง)
function renderPendingChecklist(){
  const checklistEl = document.getElementById('addChecklist');
  checklistEl.innerHTML = '';
  pendingChecklist.forEach(item => {
    const li = document.createElement('li');
    li.className = 'check-item' + (item.done ? ' done' : '');
    li.innerHTML = `
      <div class="check-box"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7l3.5 3.5L12 3" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <span class="check-label" contenteditable="true">${item.text}</span>
      <button class="item-btn" title="ลบ">✕</button>
    `;
    li.querySelector('.check-box').addEventListener('click', () => {
      item.done = !item.done; li.classList.toggle('done');
    });
    li.querySelector('.check-label').addEventListener('input', e => { item.text = e.target.textContent; });
    li.querySelector('.item-btn').addEventListener('click', () => {
      pendingChecklist = pendingChecklist.filter(i => i.id !== item.id);
      renderPendingChecklist();
      renderAddSuggestChips();
    });
    checklistEl.appendChild(li);
  });
}

function renderAddSuggestChips(){
  const el = document.getElementById('addSuggestChips');
  el.innerHTML = '';
  // ไม่เอารายการแนะนำที่ถูกเพิ่มไปแล้วมาแสดงซ้ำ แต่ยังไม่ตัดออกจาก guideItems จริง
  // เพราะยังไม่ได้กดยืนยันบันทึก (ถ้ากดยกเลิกออกจากหน้านี้ รายการแนะนำต้องไม่หายไปไหน)
  const available = guideItems.filter(g => !pendingChecklist.some(i => i.text === g));
  if(available.length === 0){
    el.innerHTML = '<span class="empty-note">ยังไม่มีรายการแนะนำ</span>';
    return;
  }
  available.forEach(text => {
    const chip = document.createElement('span');
    chip.className = 'chip'; chip.textContent = text;
    chip.addEventListener('click', () => {
      pendingChecklist.push({ id:crypto.randomUUID(), text, done:false, source:'guide' });
      renderPendingChecklist();
      renderAddSuggestChips();
    });
    el.appendChild(chip);
  });
}

function addPendingChecklistItem(){
  const input = document.getElementById('fNewChecklistItem');
  const text = input.value.trim();
  if(!text) return;
  pendingChecklist.push({ id:crypto.randomUUID(), text, done:false, source:'custom' });
  input.value = '';
  renderPendingChecklist();
}
document.getElementById('fNewChecklistItem').addEventListener('keypress', e => { if(e.key==='Enter') addPendingChecklistItem(); });

function goToPreview(){
  const name = document.getElementById('fName').value.trim();
  const place = document.getElementById('fPlace').value.trim();
  const dept = document.getElementById('fDept').value.trim();
  const date = document.getElementById('fDate').value;
  const hour = document.getElementById('fHour').value;
  const minute = document.getElementById('fMinute').value;
  if(!name || !place || !dept || !date || !hour || !minute){
    alert('กรุณากรอกข้อมูลให้ครบทุกช่องก่อนนะคะ (ยกเว้นช่องแจ้งเตือนและเช็คลิสต์)');
    return;
  }
  pendingAppt = { name, place, dept, date, time:`${hour}:${minute}`, notifications:[...selectedNotify], checklist:pendingChecklist.map(item => ({...item})) };
  document.getElementById('previewPageTitle').textContent = editingApptId ? 'ตรวจสอบการแก้ไขนัดหมาย' : 'ตรวจสอบข้อมูลนัดหมาย';
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

  const clEl = document.getElementById('pChecklist');
  clEl.innerHTML = '';
  if(pendingAppt.checklist.length === 0){
    clEl.innerHTML = '<li class="empty-note">ยังไม่ได้เพิ่มรายการเตรียมตัว</li>';
  } else {
    pendingAppt.checklist.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item.text;
      clEl.appendChild(li);
    });
  }
}

function confirmAppointment(){
  if(editingApptId){
    const appt = appointments.find(a => a.id === editingApptId);
    Object.assign(appt, pendingAppt); // รวมเช็คลิสต์ที่แก้ไขด้วย
    editingApptId = null;
  } else {
    appointments.push({ id:crypto.randomUUID(), ...pendingAppt });
  }
  pendingAppt = null;
  pendingChecklist = [];
  saveData();
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
// สถานะสำหรับ "สี" บนตารางปฏิทิน (เขียว=วันนี้, ทอง=ยังไม่ถึงนัด ไม่ว่าจะใกล้แค่ไหน, เทา=หมดอายุ)
// แยกจาก apptStatus() ซึ่งใช้กับป้ายข้อความ/ไอคอนในรายการนัด (ละเอียดกว่า มี "ใกล้ถึง" แยกจาก "วันนี้")
function calDayStatusCls(dateStr){
  const diffDays = apptStatus(dateStr).diffDays;
  if(diffDays < 0) return 'expired';
  if(diffDays === 0) return 'today';
  return 'upcoming';
}
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
    const statusCls = dayAppts.length ? calDayStatusCls(dateStr) : '';
    cell.className = 'cal-day' + (dayAppts.length ? ` has-appt cal-cell-${statusCls}` : '') + (selectedCalDate===dateStr ? ' selected' : '');
    cell.innerHTML = `<span>${d}</span>`;
    if(dayAppts.length){
      cell.addEventListener('click', () => { selectedCalDate = dateStr; renderCalendar(); renderCalDayList(dayAppts); });
    }
    grid.appendChild(cell);
  }

  // เติมช่องว่างท้ายแถวสุดท้ายให้ครบ 7 ช่อง (วันของเดือนถัดไป) ด้วยสไตล์เดียวกับช่องว่าง
  // ต้นเดือน ไม่งั้นแถวสุดท้ายจะขาด แล้วเห็นสีพื้นหลังเทาของ .cal-grid โผล่ออกมาแทน
  const trailingEmpty = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  for(let i=0;i<trailingEmpty;i++){
    const empty = document.createElement('div');
    empty.className = 'cal-day empty-cell';
    grid.appendChild(empty);
  }

  if(selectedCalDate){
    const dayAppts = appointments.filter(a => a.date === selectedCalDate);
    if(dayAppts.length) renderCalDayList(dayAppts); else document.getElementById('calDayList').innerHTML='';
  } else {
    document.getElementById('calDayList').innerHTML = '';
  }
}
function renderCalDayList(dayAppts){
  const el = document.getElementById('calDayList');
  el.innerHTML = '';
  dayAppts.forEach(appt => {
    const st = apptStatus(appt.date);
    const iconKey = statusIconKey(st.diffDays);
    const card = document.createElement('div');
    card.className = 'appt-card cal-appt-row';
    card.innerHTML = `
      <div class="status-icon status-icon-${iconKey}" title="${st.label}">${STATUS_ICONS[iconKey]}</div>
      <div class="appt-info">
        <div class="appt-name">${appt.name}</div>
        <div class="appt-place">${appt.place}${appt.dept ? ' · ' + appt.dept : ''}</div>
        <div class="appt-date">${fmtDateTh(appt.date)} · ${appt.time} น.</div>
      </div>
      <div class="cal-appt-actions">
        <button class="edit-btn" title="แก้ไข">✏️</button>
        <button class="trash-btn" title="ลบนัดหมาย">🗑</button>
      </div>
    `;
    card.querySelector('.appt-info').addEventListener('click', () => showDetail(appt.id));
    card.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); editApptFromList(appt.id); });
    card.querySelector('.trash-btn').addEventListener('click', (e) => { e.stopPropagation(); askDelete(appt.id); });
    el.appendChild(card);
  });
}

// ปัดนิ้วซ้าย-ขวาบนตารางปฏิทินเพื่อเปลี่ยนเดือน (เพิ่มเติมจากปุ่มลูกศร ‹ ›)
// แนบ listener ไว้ที่ #calGrid ตัวเดียว (ตัว container ไม่ได้ถูกสร้างใหม่ทุกครั้งที่ renderCalendar()
// แค่ innerHTML ข้างในถูกเขียนทับ) จึงไม่ต้องผูกใหม่ทุกครั้งที่ปฏิทิน render
(function setupCalendarSwipe(){
  const grid = document.getElementById('calGrid');
  const SWIPE_THRESHOLD = 50; // px
  let touchStartX = 0, touchStartY = 0;
  grid.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive:true });
  grid.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if(Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)){
      changeMonth(dx < 0 ? 1 : -1); // ปัดซ้าย = เดือนถัดไป, ปัดขวา = เดือนก่อนหน้า
    }
  }, { passive:true });
})();

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
      saveData();
    });
    li.querySelector('.check-label').addEventListener('input', e => { item.text = e.target.textContent; saveData(); });
    li.querySelector('.item-btn').addEventListener('click', () => {
      // ลบออกจากเช็คลิสต์ของนัดนี้เท่านั้น — ไม่แตะต้อง guideItems (ต้นแบบ) เลย
      // ถ้ารายการนี้มาจากต้นแบบ มันจะกลับไปโผล่เป็นตัวเลือกแนะนำของนัดนี้เองโดยอัตโนมัติ
      // (เพราะ renderSuggestChips คำนวณจาก appt.checklist ปัจจุบันทุกครั้ง)
      appt.checklist = appt.checklist.filter(i => i.id !== item.id);
      saveData();
      renderChecklist(); renderSuggestChips();
    });
    checklistEl.appendChild(li);
  });
  updateStatus();
}

function renderSuggestChips(){
  const el = document.getElementById('suggestChips');
  el.innerHTML = '';
  const appt = currentAppt();
  // ไม่โชว์ซ้ำรายการที่มีอยู่ในเช็คลิสต์ของนัดนี้แล้ว แต่ไม่ตัดออกจาก guideItems จริง
  // เพื่อไม่ให้กระทบนัดหมายอื่นหรือฟอร์มเพิ่มนัดใหม่
  const available = guideItems.filter(g => !appt.checklist.some(item => item.text === g));
  if(available.length === 0){
    el.innerHTML = '<span class="empty-note">ยังไม่มีรายการแนะนำ ลองเพิ่มได้ที่หน้าจัดการ</span>';
    return;
  }
  available.forEach(text => {
    const chip = document.createElement('span');
    chip.className = 'chip'; chip.textContent = text;
    chip.addEventListener('click', () => {
      appt.checklist.push({ id:crypto.randomUUID(), text, done:false, source:'guide' });
      saveData();
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
  saveData();
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
      saveData();
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
  saveData();
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
checkUpcomingPopup();
