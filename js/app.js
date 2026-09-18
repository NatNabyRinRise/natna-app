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

// ================= Persistence (Supabase) =================
// เก็บนัดหมาย (รวมเช็คลิสต์ของแต่ละนัด) ไว้ในตาราง `appointments` บน Supabase แทน
// localStorage เดิม — ดู supabase/schema.sql สำหรับ SQL สร้างตาราง/RLS ที่ต้องรันเองก่อน
// ส่วน guideItems (รายการแนะนำ/default checklist) ยังเก็บไว้ในโค้ดเหมือนเดิม ไม่มีตารางของตัวเอง
// (แก้ไขในหน้า "จัดการรายการแนะนำ" จะอยู่แค่ session ปัจจุบัน ไม่ persist ข้ามการรีเฟรช)
const SUPABASE_URL = 'https://bwyfgwbodupkhnmyalch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3eWZnd2JvZHVwa2hubXlhbGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjU0MDIsImV4cCI6MjEwNDg0MTQwMn0.xIi6FnIKj_ggNfofxSjdrFNBj56ieFqXEsZjHoItuw8';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const APPT_COLUMNS = 'id,name,place,dept,date,time,notifications,checklist';

async function fetchAppointmentsFromDb(){
  const { data, error } = await db.from('appointments').select(APPT_COLUMNS).order('date');
  if(error) throw error;
  return data;
}
async function insertAppointmentToDb(fields){
  const { data, error } = await db.from('appointments').insert(fields).select(APPT_COLUMNS).single();
  if(error) throw error;
  return data;
}
async function updateAppointmentInDb(id, patch){
  const { error } = await db.from('appointments').update(patch).eq('id', id);
  if(error) throw error;
}
async function deleteAppointmentFromDb(id){
  const { error } = await db.from('appointments').delete().eq('id', id);
  if(error) throw error;
}
// เรียกหลัง mutate appt.checklist ในหน่วยความจำแล้ว (fire-and-forget: ไม่บล็อก UI รอ network
// เหมือนเดิม แต่ error จริงจะแจ้งผู้ใช้ด้วย alert ให้รู้ว่าอาจไม่ได้ถูกบันทึกขึ้นเซิร์ฟเวอร์)
function persistChecklist(appt){
  updateAppointmentInDb(appt.id, { checklist: appt.checklist }).catch(e => {
    console.error('บันทึกเช็คลิสต์ขึ้น Supabase ไม่สำเร็จ', e);
    alert('บันทึกเช็คลิสต์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  });
}

// ================= Auth (Supabase Auth: อีเมล + รหัสผ่าน) =================
// ต้อง login ก่อนถึงจะเข้าแอปหลักได้ — ดู initApp() ท้ายไฟล์ที่เช็ค session ตอนเปิดแอป
// นัดหมายแต่ละแถวผูกกับ user_id ของบัญชีที่สร้าง (RLS กรองให้เห็นเฉพาะของตัวเอง — ดู
// supabase/auth-migration.sql) ฝั่ง JS จึงไม่ต้องส่ง user_id เองตอน insert เลย (DB ใส่ให้
// อัตโนมัติจาก auth.uid() ของผู้ใช้ที่ login อยู่)
let currentUser = null; // Supabase auth user object ของบัญชีที่ login อยู่ — null ถ้ายังไม่ login
let authMode = 'login'; // 'login' | 'signup' — สลับด้วยลิงก์ท้ายฟอร์ม
let cachedShareToken = null; // share token ของบัญชีที่ login อยู่ (ดู ensureShareToken()) — เคลียร์ตอน logout

function toggleAuthMode(){
  authMode = authMode === 'login' ? 'signup' : 'login';
  renderAuthMode();
  setAuthMessage('');
}
function renderAuthMode(){
  const isLogin = authMode === 'login';
  document.getElementById('authTitle').textContent = isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
  document.getElementById('authSub').textContent = isLogin
    ? 'เข้าสู่ระบบเพื่อจัดการนัดหมายของคุณ'
    : 'สมัครสมาชิกใหม่เพื่อเริ่มใช้งาน NatNa';
  document.getElementById('authSubmitBtn').textContent = isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
  document.getElementById('authToggleText').textContent = isLogin ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?';
  document.getElementById('authToggleBtn').textContent = isLogin ? 'สมัครที่นี่' : 'เข้าสู่ระบบที่นี่';
}
function setAuthMessage(text, kind){ // kind: 'error' | 'success' (เว้นว่าง = ซ่อนข้อความ)
  const el = document.getElementById('authMessage');
  el.textContent = text;
  el.className = 'auth-message' + (kind ? ` auth-message-${kind}` : '');
  el.classList.toggle('hidden', !text);
}
function showAuthPage(){
  hideAllPages();
  document.getElementById('authPage').classList.remove('hidden');
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  authMode = 'login';
  renderAuthMode();
  setAuthMessage('');
}

async function handleAuthSubmit(){
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if(!email || !password){
    setAuthMessage('กรุณากรอกอีเมลและรหัสผ่านให้ครบ', 'error');
    return;
  }
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true;
  try {
    if(authMode === 'login'){
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if(error) throw error;
      await onAuthSuccess(data.session);
    } else {
      const { data, error } = await db.auth.signUp({ email, password });
      if(error) throw error;
      if(data.session){
        // โปรเจกต์นี้ปิดการยืนยันอีเมล (หรือยืนยันแล้วทันที) -> ได้ session พร้อมใช้งานเลย
        await onAuthSuccess(data.session);
      } else {
        // ยังไม่มี session -> โปรเจกต์เปิดให้ต้องกดยืนยันลิงก์ในอีเมลก่อนถึงจะ login ได้
        authMode = 'login';
        renderAuthMode();
        setAuthMessage('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ', 'success');
      }
    }
  } catch(e) {
    console.error('Auth error', e);
    setAuthMessage(e.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
  } finally {
    btn.disabled = false;
  }
}
document.getElementById('authEmail').addEventListener('keypress', e => { if(e.key==='Enter') handleAuthSubmit(); });
document.getElementById('authPassword').addEventListener('keypress', e => { if(e.key==='Enter') handleAuthSubmit(); });

async function onAuthSuccess(session){
  currentUser = session.user;
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('loadingState').classList.remove('hidden');
  await loadAppointmentsAndShowHome();
  document.getElementById('loadingState').classList.add('hidden');
}

function handleLogout(){
  db.auth.signOut().then(() => {
    currentUser = null;
    appointments = [];
    cachedShareToken = null;
    showAuthPage();
  }).catch(e => {
    console.error('ออกจากระบบไม่สำเร็จ', e);
    alert('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
  });
}

// ================= Share link (แชร์ให้ผู้สูงอายุดูนัดหมาย/ติ๊กเช็คลิสต์ได้โดยไม่ต้อง login) ===
// แต่ละบัญชีมี share_token 1 อันเก็บไว้ในตาราง profiles (ดู supabase/share-migration.sql) —
// สุ่มสร้างอัตโนมัติด้วย gen_random_uuid() ตอนแถวถูกสร้างในฐานข้อมูล ฟังก์ชันนี้แค่เช็คว่ามี
// แถวโปรไฟล์ของผู้ใช้คนนี้อยู่แล้วหรือยัง ถ้ายังไม่มีก็สร้างให้ (เรียกจาก loadAppointmentsAndShowHome()
// ทุกครั้งที่ login/เปิดแอปสำเร็จ ตามที่ขอว่า "สุ่มสร้างอัตโนมัติตอนสมัครหรือ login ครั้งแรก")
async function ensureShareToken(){
  try {
    const { data, error } = await db.from('profiles').select('share_token').eq('id', currentUser.id).maybeSingle();
    if(error) throw error;
    if(data && data.share_token) return data.share_token;
    // ยังไม่มีแถวโปรไฟล์ -> สร้างใหม่ (share_token ได้ default จาก DB อัตโนมัติ ไม่ต้องส่งเอง)
    const { data: inserted, error: insErr } = await db.from('profiles').insert({ id: currentUser.id }).select('share_token').single();
    if(insErr) throw insErr;
    return inserted.share_token;
  } catch(e) {
    console.error('สร้าง/ดึง share token ไม่สำเร็จ', e);
    return null;
  }
}

async function openShareModal(){
  if(!cachedShareToken){
    cachedShareToken = await ensureShareToken();
    if(!cachedShareToken){
      alert('สร้างลิงก์แชร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      return;
    }
  }
  const url = `${location.origin}${location.pathname}?share=${cachedShareToken}`;
  document.getElementById('shareLinkText').textContent = url;
  document.getElementById('shareModal').classList.remove('hidden');
  const qrEl = document.getElementById('shareQrCanvas');
  qrEl.innerHTML = ''; // เคลียร์ QR code เก่าก่อน เผื่อเปิด modal ซ้ำหลายครั้ง (qrcodejs ไม่เคลียร์ให้เอง)
  try {
    new QRCode(qrEl, { text: url, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
  } catch(e) {
    console.error('สร้าง QR code ไม่สำเร็จ', e);
  }
}
function closeShareModal(){
  document.getElementById('shareModal').classList.add('hidden');
}
function copyShareLink(){
  const text = document.getElementById('shareLinkText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('คัดลอกลิงก์แล้ว');
  }).catch(() => {
    alert('คัดลอกอัตโนมัติไม่สำเร็จ กรุณาคัดลอกด้วยตัวเองจากข้อความที่แสดงอยู่');
  });
}

// ================= Shared view (เปิดผ่านลิงก์แชร์ ?share=TOKEN — ไม่ต้อง login เลย) =========
// ดู/ติ๊กเช็คลิสต์ได้อย่างเดียว ไม่มีปุ่มเพิ่ม/แก้ไข/ลบใดๆ — ข้อมูลดึงผ่าน RPC ฟังก์ชันเฉพาะ
// (get_shared_view / toggle_shared_checklist_item ใน supabase/share-migration.sql) ที่บังคับ
// สิทธิ์ไว้ในระดับฐานข้อมูลแล้ว ไม่ได้พึ่งแค่การซ่อนปุ่มในหน้าเว็บอย่างเดียว
let sharedToken = null;
let sharedAppointments = [];

async function initSharedView(token){
  hideAllPages();
  try {
    const { data, error } = await db.rpc('get_shared_view', { p_token: token });
    if(error) throw error;
    if(!data || !data.valid){ showSharedInvalid(); return; }
    sharedToken = token;
    sharedAppointments = data.appointments || [];
    renderSharedList();
    document.getElementById('sharedPage').classList.remove('hidden');
  } catch(e) {
    console.error('โหลดข้อมูลลิงก์แชร์ไม่สำเร็จ', e);
    showSharedInvalid();
  }
}
function showSharedInvalid(){
  hideAllPages();
  document.getElementById('sharedInvalidPage').classList.remove('hidden');
}

function renderSharedList(){
  const el = document.getElementById('sharedList');
  el.innerHTML = '';
  if(sharedAppointments.length === 0){
    el.innerHTML = '<div class="shared-empty-note">ยังไม่มีนัดหมาย</div>';
    return;
  }
  const sorted = [...sharedAppointments].sort((a,b) => {
    const da = apptStatus(a.date).diffDays, db2 = apptStatus(b.date).diffDays;
    const aExpired = da < 0, bExpired = db2 < 0;
    if(aExpired !== bExpired) return aExpired ? 1 : -1; // นัดที่ยังไม่หมดอายุขึ้นก่อนเสมอ
    if(!aExpired) return da - db2; // ใกล้ถึงที่สุดขึ้นก่อน
    return db2 - da; // หมดอายุ: เพิ่งผ่านไปหมาดๆ ขึ้นก่อน
  });
  sorted.forEach(appt => {
    const st = apptStatus(appt.date);
    const iconKey = statusIconKey(st.diffDays);
    const card = document.createElement('div');
    card.className = 'shared-appt-card';
    card.innerHTML = `
      <div class="shared-appt-head">
        <div class="status-icon status-icon-${iconKey}" title="${st.label}">${STATUS_ICONS[iconKey]}</div>
        <div style="flex:1;min-width:0;">
          <div class="shared-appt-name">${appt.name}</div>
          <div class="shared-appt-place">${appt.place}${appt.dept ? ' · ' + appt.dept : ''}</div>
          <div class="shared-appt-date">${fmtDateTh(appt.date)} · ${appt.time} น.</div>
        </div>
        <span class="badge badge-${st.cls}">${st.label}</span>
      </div>
      <ul class="shared-checklist"></ul>
    `;
    const listEl = card.querySelector('.shared-checklist');
    if(appt.checklist.length === 0){
      listEl.innerHTML = '<li class="shared-empty-note" style="padding:10px 4px;">ยังไม่มีเช็คลิสต์</li>';
    } else {
      appt.checklist.forEach(item => {
        const li = document.createElement('li');
        li.className = 'shared-check-item' + (item.done ? ' done' : '');
        li.innerHTML = `
          <div class="shared-check-box"><svg width="18" height="18" viewBox="0 0 14 14"><path d="M2 7l3.5 3.5L12 3" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <span class="shared-check-label">${item.text}</span>
        `;
        // ติ๊ก/ยกเลิกติ๊กได้อย่างเดียว — ไม่มี contenteditable บนข้อความ ไม่มีปุ่มลบ
        li.addEventListener('click', () => toggleSharedItem(appt, item, li));
        listEl.appendChild(li);
      });
    }
    el.appendChild(card);
  });
}

function toggleSharedItem(appt, item, li){
  const newDone = !item.done;
  item.done = newDone; // อัปเดตหน้าจอทันทีแบบ optimistic เหมือนจุดอื่นในแอป
  li.classList.toggle('done', newDone);
  db.rpc('toggle_shared_checklist_item', {
    p_token: sharedToken, p_appt_id: appt.id, p_item_id: item.id, p_done: newDone
  }).then(({ data, error }) => {
    if(error || data === false){
      // บันทึกไม่สำเร็จ -> ย้อนสถานะบนหน้าจอกลับ กันข้อมูลไม่ตรงกับฐานข้อมูลจริง
      item.done = !newDone;
      li.classList.toggle('done', !newDone);
      console.error('บันทึกเช็คลิสต์ (shared view) ไม่สำเร็จ', error);
      alert('บันทึกไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    }
  });
}

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
// แปลงค่าตัวเลือกแจ้งเตือน (เช่น '3d', '1h') เป็นระยะเวลาหน่วยมิลลิวินาที ใช้เทียบกับเวลาที่เหลือจริง
function notifyThresholdMs(value){
  const n = parseInt(value, 10);
  const unit = value.slice(-1); // 'd' หรือ 'h'
  return unit === 'h' ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
}
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
  ['authPage','homePage','addPage','previewPage','detailPage','managePage'].forEach(id => document.getElementById(id).classList.add('hidden'));
}
function showHome(){
  hideAllPages();
  document.getElementById('homePage').classList.remove('hidden');
  renderCardView();
  renderCalendar();
  renderMascotBadge();
}
// อัปเดตตัวเลขบนป้ายมาสคอต = จำนวนนัดหมายที่เหลือน้อยกว่า 5 วัน (นับรวมวันนี้ ไม่นับที่หมดอายุ
// ไปแล้ว) เรียกจาก showHome() ทุกครั้งที่กลับมาหน้าแรก จึงอัปเดตตามข้อมูลจริงเสมอเมื่อมีการ
// เพิ่ม/แก้ไข/ลบนัดหมาย (ทุก flow ที่เปลี่ยนแปลงนัดหมายจะเรียก showHome() อยู่แล้ว)
function renderMascotBadge(){
  const count = appointments.filter(a => {
    const diffDays = apptStatus(a.date).diffDays;
    return diffDays >= 0 && diffDays < 5;
  }).length;
  const el = document.getElementById('mascotBadgeCount');
  if(el) el.textContent = count;
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
const DEFAULT_POPUP_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // ค่าเริ่มต้น: น้อยกว่า 5 วัน (ใช้เมื่อนัดนั้นไม่ได้ตั้งค่าแจ้งเตือนไว้เลย)

// เช็คว่านัดหมายไหนควรเด้งแจ้งเตือน โดยเทียบ "เวลาที่เหลือจริง" (นับถึงวันเวลานัดจริง ไม่ใช่แค่นับวัน)
// กับตัวเลือกแจ้งเตือนล่วงหน้าที่ผู้ใช้เลือกไว้สำหรับนัดนั้น (notifications) และกฎ default (น้อยกว่า
// 5 วัน) พร้อมกันเสมอ — เข้าเงื่อนไข "อย่างใดอย่างหนึ่ง" ก็ขึ้นป๊อปอัป (ใช้กฎที่แคบกว่า/ครอบคลุมกว่า
// เสมอ) การตั้งแจ้งเตือนเฉพาะไว้ (เช่น "1 วันก่อน") จะไม่ไปบล็อกไม่ให้ขึ้นตามกฎ default อีกต่อไป —
// เดิมถ้าตั้งแจ้งเตือนไว้แล้วยังไม่ถึงเวลานั้น นัดจะไม่ขึ้นป๊อปอัปเลยแม้เหลือแค่ไม่กี่วัน ซึ่งทำให้
// นัดที่เพิ่งเพิ่มใหม่ (ที่มักตั้งแจ้งเตือนไว้ตั้งแต่ตอนเพิ่ม) ดูเหมือนหายไปจากป๊อปอัปอย่างไม่คาดคิด
function checkUpcomingPopup(){
  const now = new Date();
  const upcoming = [];

  appointments.forEach(appt => {
    const target = new Date(`${appt.date}T${appt.time}:00`);
    const remainingMs = target - now;
    if(remainingMs < 0) return; // นัดผ่านไปแล้ว ไม่ต้องแจ้งเตือน

    const notifs = appt.notifications || [];
    // เข้าเงื่อนไขถ้าเวลาที่เหลือ <= อย่างน้อยหนึ่งตัวเลือกที่เลือกไว้ — ใช้ตัวที่แคบที่สุดที่ยัง
    // เข้าเงื่อนไขเป็นเหตุผลที่แสดง (ตรงประเด็น/ใกล้เวลาจริงที่สุด)
    const matched = notifs
      .filter(v => remainingMs <= notifyThresholdMs(v))
      .sort((a,b) => notifyThresholdMs(a) - notifyThresholdMs(b));

    if(matched.length > 0){
      const label = NOTIFY_OPTIONS.find(o => o.value === matched[0]).label;
      upcoming.push({ appt, remainingMs, reason: `🔔 ถึงกำหนดแจ้งเตือนล่วงหน้า ${label}` });
    } else if(remainingMs < DEFAULT_POPUP_THRESHOLD_MS){
      // ยังไม่ถึงเวลาแจ้งเตือนที่ตั้งไว้ (หรือไม่ได้ตั้งไว้เลย) แต่เข้ากฎ default (<5 วัน) แล้ว —
      // ให้ขึ้นป๊อปอัปด้วยเหตุผลที่ต่างกันไปตามกรณี
      const reason = notifs.length > 0
        ? 'ใกล้ถึงนัด (ยังไม่ถึงกำหนดแจ้งเตือนที่ตั้งไว้)'
        : 'ใกล้ถึงนัด (ยังไม่ได้ตั้งการแจ้งเตือนไว้)';
      upcoming.push({ appt, remainingMs, reason });
    }
  });

  if(upcoming.length === 0) return; // ไม่มีนัดแบบนี้ ไม่ต้องขึ้น pop-up
  upcoming.sort((a,b) => a.remainingMs - b.remainingMs);

  const el = document.getElementById('upcomingModalList');
  el.innerHTML = '';
  upcoming.forEach(({ appt, reason }) => {
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
        <div class="popup-reason">${reason}</div>
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
  const id = deleteTargetId;
  // ลบออกจากหน้าจอทันที (เร็วเหมือนเดิม) แล้วค่อยยิงลบขึ้น Supabase ตามหลังแบบไม่บล็อก UI
  appointments = appointments.filter(a => a.id !== id);
  deleteTargetId = null;
  document.getElementById('confirmModal').classList.add('hidden');
  renderCardView();
  renderCalendar();
  deleteAppointmentFromDb(id).catch(e => {
    console.error('ลบนัดหมายออกจาก Supabase ไม่สำเร็จ', e);
    alert('ลบนัดหมายไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  });
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

async function confirmAppointment(){
  if(editingApptId){
    const appt = appointments.find(a => a.id === editingApptId);
    const patch = pendingAppt;
    Object.assign(appt, patch); // รวมเช็คลิสต์ที่แก้ไขด้วย — อัปเดตหน้าจอทันทีเหมือนเดิม
    const id = editingApptId;
    editingApptId = null;
    pendingAppt = null;
    pendingChecklist = [];
    showHome();
    // ยิงอัปเดตขึ้น Supabase ตามหลังแบบไม่บล็อก UI (id เดิมอยู่แล้ว ไม่ต้องรอ)
    updateAppointmentInDb(id, patch).catch(e => {
      console.error('บันทึกการแก้ไขนัดหมายขึ้น Supabase ไม่สำเร็จ', e);
      alert('บันทึกการแก้ไขไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    });
  } else {
    // นัดใหม่ต้องรอ id จริงจาก Supabase ก่อน ถึงจะเก็บเข้า appointments ในหน่วยความจำได้
    try {
      const newAppt = await insertAppointmentToDb(pendingAppt);
      appointments.push(newAppt);
      pendingAppt = null;
      pendingChecklist = [];
      showHome();
    } catch(e) {
      console.error('บันทึกนัดหมายใหม่ขึ้น Supabase ไม่สำเร็จ', e);
      alert('บันทึกนัดหมายไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    }
  }
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
      persistChecklist(appt);
    });
    li.querySelector('.check-label').addEventListener('input', e => { item.text = e.target.textContent; persistChecklist(appt); });
    li.querySelector('.item-btn').addEventListener('click', () => {
      // ลบออกจากเช็คลิสต์ของนัดนี้เท่านั้น — ไม่แตะต้อง guideItems (ต้นแบบ) เลย
      // ถ้ารายการนี้มาจากต้นแบบ มันจะกลับไปโผล่เป็นตัวเลือกแนะนำของนัดนี้เองโดยอัตโนมัติ
      // (เพราะ renderSuggestChips คำนวณจาก appt.checklist ปัจจุบันทุกครั้ง)
      appt.checklist = appt.checklist.filter(i => i.id !== item.id);
      persistChecklist(appt);
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
      persistChecklist(appt);
      renderChecklist(); renderSuggestChips();
    });
    el.appendChild(chip);
  });
}

function addCustomItem(){
  const input = document.getElementById('newItem');
  const text = input.value.trim();
  if(!text) return;
  const appt = currentAppt();
  appt.checklist.push({ id:crypto.randomUUID(), text, done:false, source:'custom' });
  input.value = '';
  persistChecklist(appt);
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
      // guideItems ไม่ persist ไปไหน (เก็บไว้ในโค้ดเหมือนเดิม) แก้ที่นี่จะอยู่แค่ session นี้
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

// โหลดนัดหมายจาก Supabase (ของบัญชีที่ login อยู่ — RLS กรองให้อัตโนมัติ) แล้วแสดงหน้าแรก
// ถ้าโหลดไม่สำเร็จ (เน็ตล่ม ฯลฯ) ใช้ข้อมูลตัวอย่างเริ่มต้นที่ตั้งไว้ด้านบนแทนไปก่อน เรียกทั้งจาก
// initApp() ตอนเปิดแอปแล้วมี session อยู่แล้ว และจาก onAuthSuccess() หลัง login/สมัครสำเร็จ
//
// สำคัญ: ต้อง await ให้ appointments โหลดมาครบก่อน แล้วค่อยเรียก checkUpcomingPopup() —
// ห้ามเรียกก่อนหน้านั้นเด็ดขาด (เช่น ตอน appointments ยังเป็นค่าเริ่มต้นตอนประกาศตัวแปร)
// ไม่งั้นป๊อปอัปจะคำนวณจากข้อมูลที่ยังโหลดไม่ครบ/ยังไม่ใช่ของจริงจาก Supabase
async function loadAppointmentsAndShowHome(){
  // สร้าง share token ให้บัญชีนี้ถ้ายังไม่มี (ตามที่ขอ "สร้างอัตโนมัติตอนสมัครหรือ login ครั้งแรก")
  // ยิงแบบไม่รอ (fire-and-forget) ไม่บล็อกการโหลดนัดหมาย เพราะยังไม่จำเป็นต้องใช้จนกว่าจะกด
  // ปุ่ม "แชร์ให้ผู้สูงอายุ" — พอถึงตอนนั้น cachedShareToken ก็มักจะพร้อมอยู่แล้วโดยไม่ต้องรอ
  ensureShareToken().then(token => { cachedShareToken = token; });

  let loadFailed = false;
  try {
    appointments = await fetchAppointmentsFromDb();
  } catch(e) {
    loadFailed = true;
    console.error('โหลดข้อมูลจาก Supabase ไม่สำเร็จ ใช้ข้อมูลตัวอย่างเริ่มต้นแทนชั่วคราว', e);
  }
  showHome();
  if(loadFailed){
    // โหลดข้อมูลจริงไม่สำเร็จ -> appointments ตอนนี้คือข้อมูลตัวอย่าง (mock) ที่ hardcode ไว้
    // ไม่ใช่นัดหมายจริงของผู้ใช้ ถ้าเด้งป๊อปอัป "นัดใกล้ถึง" ไปด้วยจะยิ่งทำให้เข้าใจผิดว่าเป็น
    // รายการนัดจริง (ทั้งที่ไม่ใช่ และอาจดูเหมือนรายการไม่ครบเมื่อเทียบกับนัดจริงที่มีอยู่) จึง
    // ไม่เรียก checkUpcomingPopup() ในกรณีนี้ และแจ้งผู้ใช้ตรง ๆ แทนว่าโหลดข้อมูลจริงไม่สำเร็จ
    alert('โหลดข้อมูลนัดหมายจาก Supabase ไม่สำเร็จ กำลังแสดงข้อมูลตัวอย่างชั่วคราวแทน กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองรีโหลดหน้าใหม่');
  } else {
    checkUpcomingPopup();
  }
}

// จุดเริ่มแอป: เช็คก่อนว่ามี session ค้างอยู่ไหม (login ไว้จากรอบก่อนแล้วยังไม่ signOut) —
// มี -> เข้าแอปหลักตามปกติ, ไม่มี -> แสดงหน้า login/สมัครสมาชิกก่อนเสมอ
//
// ใช้ getUser() แทน getSession() โดยเจตนา: getSession() อ่านจาก localStorage เฉยๆ ไม่ได้
// ยืนยันกับ Supabase ว่า token ยังใช้ได้จริง ถ้า token ค้างอยู่แต่ใช้ไม่ได้แล้ว (เช่น โดน
// signOut จากที่อื่น, JWT secret/anon key ถูกรีเซ็ตในโปรเจกต์ Supabase) getSession() จะยัง
// คืนค่า session เดิมมาเหมือนใช้ได้ปกติ ทำให้แอปข้ามหน้า login ไปเลย ทั้งที่จริงแล้ว
// เรียก fetchAppointmentsFromDb() ต่อจะเจอ 401 แล้ว fallback ไปข้อมูลตัวอย่างแทนแบบงงๆ
// (ดูเหมือนไม่มีหน้า login แต่ก็ไม่เห็นข้อมูลจริง) — getUser() ยืนยันกับเซิร์ฟเวอร์จริง ถ้า
// token ใช้ไม่ได้จะ error ออกมาให้รู้ทันที เลยพากลับไปหน้า login ให้ถูกต้อง พร้อม signOut()
// เคลียร์ session ค้างที่ใช้ไม่ได้ทิ้งไปด้วย กันไม่ให้วนเจอปัญหาเดิมซ้ำทุกครั้งที่เปิดแอป
//
// ข้อยกเว้น: ถ้า URL มี ?share=TOKEN ต่อท้าย แปลว่าเปิดผ่านลิงก์แชร์ (สำหรับผู้สูงอายุ) —
// ต้องแยกออกจาก flow login ปกติทั้งหมด "ไม่ต้อง login เลย" ตามที่ขอ จึงเช็คจุดนี้เป็นอันดับ
// แรกสุดก่อนเช็ค session ใดๆ ถ้าเจอ token ให้เข้าโหมดแสดงหน้าแชร์แล้ว return ออกไปเลย
async function initApp(){
  const shareToken = new URLSearchParams(location.search).get('share');
  if(shareToken){
    await initSharedView(shareToken);
    document.getElementById('loadingState').classList.add('hidden');
    return;
  }

  populateTimeSelects();
  renderNotifyChips();
  const { data: { user }, error } = await db.auth.getUser();
  if(user && !error){
    currentUser = user;
    await loadAppointmentsAndShowHome();
  } else {
    if(error) await db.auth.signOut().catch(() => {});
    showAuthPage();
  }
  document.getElementById('loadingState').classList.add('hidden');
}
initApp();
