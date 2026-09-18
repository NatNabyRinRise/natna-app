# CLAUDE.md

คำแนะนำสำหรับ Claude Code (claude.ai/code) เมื่อทำงานกับโค้ดในโปรเจกต์นี้

## แอปนี้คืออะไร

**NatNa (นัดนะ)** เป็นเว็บแอปสาธิต (demo/prototype) สำหรับช่วยผู้ดูแล (เช่น ลูกหลาน)
เตรียมความพร้อมก่อนพาผู้สูงอายุ/คนไข้ไปพบแพทย์ตามนัด

ฟีเจอร์หลัก:
- **หน้าแรก**: แสดงรายการนัดหมายเป็นการ์ด หรือสลับไปมุมมองปฏิทินรายเดือน พร้อมสถานะ
  (ใกล้ถึง / วันนี้ / หมดอายุ) ตามจำนวนวันที่เหลือ
- **เพิ่มนัดหมาย**: ฟอร์มกรอกชื่อคนไข้ สถานที่ วันที่ และเวลานัด
- **หน้ารายละเอียด/เช็คลิสต์**: เช็คลิสต์สิ่งที่ต้องเตรียมต่อนัดหมายหนึ่งรายการ
  ติ๊กถูก/แก้ไขข้อความ/ลบรายการได้ พร้อมสถานะ "พร้อมแล้ว" / "ยังไม่พร้อม"
  เมื่อเช็คครบทุกข้อ
- **รายการแนะนำ (guide items)**: ชิปคำแนะนำที่แตะเพื่อเพิ่มเข้าเช็คลิสต์ได้ทันที
  และมีหน้าแยกสำหรับจัดการ (เพิ่ม/ลบ) รายการแนะนำเหล่านี้
- **ลบนัดหมาย**: มี modal ยืนยันก่อนลบ
- **มาสคอต (หน้าแรก)**: การ์ตูนแมวใต้ header พร้อมป้ายวงกลมสีทองแสดงจำนวนนัดหมายที่เหลือ
  น้อยกว่า 5 วัน คำนวณสดจาก `appointments` ทุกครั้งที่กลับมาหน้าแรก (`renderMascotBadge()`
  เรียกจาก `showHome()`)
- **Login/สมัครสมาชิก**: หน้าเดียวสลับโหมด login/signup ด้วยลิงก์ท้ายฟอร์ม (`authMode`,
  `toggleAuthMode()`) ต้อง login ก่อนเสมอถึงจะเห็นแอปหลัก (`#authPage` แสดงก่อนถ้ายังไม่มี
  session) มีปุ่ม "ออกจากระบบ" มุมขวาบนของหน้าแรก (`handleLogout()`)

**นัดหมาย (รวมเช็คลิสต์ของแต่ละนัด)** เก็บอยู่บน **Supabase** (ตาราง `appointments` — ดู
`supabase/schema.sql`) ผ่าน `@supabase/supabase-js` ที่โหลดจาก CDN — รีโหลดหน้าจะดึงข้อมูล
ล่าสุดจาก Supabase กลับมาเสมอ (ไม่ใช่ mock data คงที่อีกต่อไป) ถ้าโหลดไม่สำเร็จ (ยังไม่ได้รัน
schema.sql, เน็ตล่ม ฯลฯ) จะ fallback ไปใช้ข้อมูลตัวอย่าง (mock data) ที่ hardcode ไว้ในโค้ดแทน

**🔐 มีระบบ login แล้ว (Supabase Auth: อีเมล + รหัสผ่าน)**: ต้อง login ก่อนถึงจะเข้าแอปหลัก
และเห็นข้อมูลนัดหมายได้ (`#authPage` — ดูฟังก์ชันหมวด "Auth" ใน `js/app.js`) นัดหมายแต่ละแถว
ผูกกับ `user_id` ของบัญชีที่สร้าง (คอลัมน์ default เป็น `auth.uid()` ให้อัตโนมัติตอน insert
ไม่ต้องส่งจาก JS) และ **RLS กรองให้แต่ละบัญชีเห็น/แก้ไข/ลบได้เฉพาะนัดหมายของตัวเองเท่านั้น**
ไม่เห็นของบัญชีอื่น (ดู `supabase/auth-migration.sql`) — ต่างจากเดิมที่ใช้ anon key เดียว
เปิดให้ทุกคนเห็นร่วมกันหมด ตอนนี้แต่ละบัญชี "คนดูแล" (caregiver) มีข้อมูลของตัวเองแยกกันแล้ว

**รายการแนะนำ (`guideItems`)** ยังคง**อยู่ในโค้ดเป็น JavaScript state ในหน่วยความจำเท่านั้น**
เหมือนเดิม ไม่มีตารางของตัวเอง — แก้ไขในหน้า "จัดการรายการแนะนำ" (เพิ่ม/ลบ) จะอยู่แค่ session
ปัจจุบัน รีโหลดหน้าแล้วรีเซ็ตกลับไปเป็นรายการที่ hardcode ไว้เสมอ (ตั้งใจให้เป็นแบบนี้ ไม่ใช่บั๊ก)

## เทคโนโลยีที่ใช้

- **Vanilla HTML/CSS/JavaScript** ล้วน ๆ — ไม่มี build step, ไม่มี framework
  (ไม่ใช้ React/Vue), ไม่มี package.json / npm dependencies
- **Supabase** เป็น backend สำหรับตาราง `appointments` เท่านั้น — โหลด client library ผ่าน
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@.../dist/umd/supabase.js">`
  ก่อน `js/app.js` (ยังไม่มี build step อยู่ดี ใช้ CDN + global `window.supabase.createClient()`)
- ฟอนต์ **K2D** จาก Google Fonts (โหลดผ่าน `<link>` ใน `<head>`) ใช้ทั้งหัวข้อและเนื้อความ
- ใช้ `crypto.randomUUID()` ของเบราว์เซอร์สำหรับสร้าง id ของรายการเช็คลิสต์ (id ของนัดหมาย
  แต่ละนัดมาจาก Postgres `gen_random_uuid()` ตอน insert แทน)
- CSS ธรรมดา ใช้ CSS custom properties (`:root { --gold: ...; --ink: ...; }`) เป็น design
  tokens สำหรับโทนสี ไม่มี CSS framework (ไม่ใช่ Tailwind/Bootstrap) — โทนสีหลักไล่เฉด
  เขียวมะนาว (`--lime`) → เขียว (`--green`) → เขียวหัวเป็ดเข้ม (`--teal-dark`) ดึงจากโลโก้
  `assets/logo-new.png` โดย `--ink`/`--ink-soft` ก็อิงโทนเขียวหัวเป็ดเช่นกัน ส่วน `--gold`
  (ตัวแปรชื่อเดิม แต่ค่าเปลี่ยนเป็น `#F2A93B`) ใช้เป็นสี contrast สำหรับปุ่มเน้น/สถานะสำคัญ
  (ปุ่มหลัก, ชิปที่เลือก, ป้ายมาสคอต, วงกลม "วันนี้" ในปฏิทิน) แทนโทนทองเดิม
- ไม่มี test suite และไม่มี build/deploy script ใด ๆ ในโปรเจกต์นี้

### วิธีรันดูแอป

เปิดไฟล์ `index.html` ในเบราว์เซอร์ได้ตรง ๆ หรือรันเซิร์ฟเวอร์ static ง่าย ๆ เช่น:

```bash
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000/index.html
```

### ตั้งค่า Supabase ครั้งแรก (ต้องรันตามลำดับ)

รันไฟล์ SQL ใน `supabase/` ทีละไฟล์ผ่าน Supabase Dashboard → SQL Editor:
1. `schema.sql` — สร้างตาราง `appointments` + seed ข้อมูลตัวอย่าง 4 รายการ
2. `auth-migration.sql` — เพิ่ม `user_id` + เปลี่ยน RLS ให้กรองตามบัญชีที่ login (รันได้ทันที)
3. สมัครบัญชีแรกในแอป แล้วค่อยรัน `auth-backfill.sql` — มอบข้อมูลตัวอย่าง 4 รายการเดิมให้
   เป็นของบัญชีนั้น (ข้ามขั้นนี้ได้ถ้าไม่ต้องการข้อมูลตัวอย่าง)

## โครงสร้างไฟล์

```
natna-app/
├── index.html        # โครงสร้างหน้าเว็บ (markup) ทั้งหมด — ไม่มี inline <style>/<script> แล้ว
├── css/
│   └── style.css      # สไตล์ทั้งหมดของแอป (design tokens, layout, ทุกหน้า/คอมโพเนนต์)
├── js/
│   └── app.js          # ตรรกะแอปทั้งหมด: state, การ render, event handlers
├── assets/
│   ├── logo.png          # โลโก้เก่า (ไม่ได้ใช้แสดงผลในแอปแล้ว เหลือไว้เผื่ออ้างอิง)
│   ├── logo-new.png      # โลโก้ปัจจุบันที่ใช้ใน header (มีคำว่า "NatNa นัดนะ" อยู่ในภาพแล้ว
│   │                       จึงไม่มีข้อความ/คำโปรยแยกอยู่ข้างๆ อีกต่อไป)
│   └── mascot-cat.png    # ภาพมาสคอตแมว แสดงในกรอบใต้ header ของหน้าแรก
└── supabase/            # ไฟล์ SQL ที่ต้องรันเองใน Supabase Dashboard → SQL Editor (เรียงลำดับ)
    ├── schema.sql          # สร้างตาราง appointments + seed ข้อมูลตัวอย่าง
    ├── auth-migration.sql  # เพิ่ม user_id + เปลี่ยน RLS ให้กรองตามบัญชีที่ login
    └── auth-backfill.sql   # มอบข้อมูลตัวอย่างเดิมให้บัญชีแรกที่สมัคร (รันหลังสมัครแล้ว)
```

เดิมโค้ดทั้งหมด (HTML + CSS + JS + โลโก้แบบ base64) อยู่รวมกันในไฟล์ `index.html`
ไฟล์เดียว (~600 บรรทัด) ภายหลังถูกแยกออกเป็นโครงสร้างข้างต้นเพื่อให้ดูแลรักษาง่ายขึ้น
โดย **ไม่มีการเปลี่ยนแปลงฟีเจอร์หรือดีไซน์ใด ๆ** — พฤติกรรมของแอปเหมือนเดิมทุกประการ

### รายละเอียด `js/app.js`

ไฟล์เดียวที่รวม state และฟังก์ชันทั้งหมด แบ่งเป็นส่วน ๆ ด้วยคอมเมนต์ตามลำดับนี้:

- **STATE** — ตัวแปร global: `guideItems`, `appointments` (mock data), `currentApptId`,
  `deleteTargetId`, ตัวแปรสถานะปฏิทิน (`calMonth`, `calYear`, `selectedCalDate`)
- **Auth** — login/สมัครสมาชิก/ออกจากระบบ ด้วย Supabase Auth (`handleAuthSubmit`,
  `toggleAuthMode`, `handleLogout`, `currentUser`) และจุดเข้าแอปหลังผ่าน auth
  (`onAuthSuccess`, `loadAppointmentsAndShowHome`)
- **NAV** — สลับการแสดงผลระหว่างหน้า (`showHome`, `showAddForm`, `showDetail`, `showManage`,
  `showAuthPage`)
- **Status helper** — คำนวณสถานะนัดหมาย (`apptStatus`) และจัดรูปแบบวันที่ไทย (`fmtDateTh`)
- **Card view** — render รายการนัดหมายเป็นการ์ด (`renderCardView`), ป้ายมาสคอต
  (`renderMascotBadge` — นับนัดหมายที่เหลือ <5 วัน เรียกจาก `showHome()`)
- **Delete confirm** — flow ยืนยันการลบ (`askDelete`, `cancelDelete`, `confirmDelete`)
- **Add appointment** — บันทึกนัดหมายใหม่ (`submitAddForm`)
- **Calendar view** — render ปฏิทินรายเดือนและรายการนัดของวันที่เลือก
  (`renderCalendar`, `renderCalDayList`, `changeMonth`)
- **Detail page (checklist)** — render/แก้ไขเช็คลิสต์และสถานะความพร้อม
  (`renderDetail`, `renderChecklist`, `renderSuggestChips`, `addCustomItem`, `updateStatus`)
- **Manage guide list** — เพิ่ม/ลบรายการแนะนำ (`renderGuideManageList`, `addGuideItem`)

หน้าเว็บทั้งหมดในแอปเป็น `<div>` ที่ซ่อน/แสดงด้วยคลาส `hidden` (single-page app แบบง่าย
ไม่มี router/URL routing) — element id หลักที่แต่ละหน้าใช้คือ `authPage`, `homePage`,
`addPage`, `detailPage`, `managePage`

## หมายเหตุสำหรับการแก้ไขโค้ดครั้งต่อไป

- อย่าใส่ `<style>`/`<script>` แบบ inline กลับเข้าไปใน `index.html` อีก — ให้แก้ที่
  `css/style.css` / `js/app.js` แทนเพื่อรักษาโครงสร้างที่แยกไว้
- ถ้าจะเพิ่มรูปภาพ/ไอคอนใหม่ ให้เก็บไว้ใน `assets/` แทนการฝัง base64 ในโค้ด
- โทนสี/ฟอนต์อ้างอิงผ่าน CSS custom properties ใน `:root` ของ `css/style.css` เท่านั้น —
  ถ้าจะปรับโทนสีอีก ให้แก้ที่ตัวแปรใน `:root` แทนการไล่แก้ค่าสีทีละจุดทั่วไฟล์
