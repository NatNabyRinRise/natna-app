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

ข้อมูลทั้งหมด (นัดหมาย, เช็คลิสต์, รายการแนะนำ) เก็บอยู่ใน **JavaScript state ในหน่วยความจำ
เท่านั้น** (ไม่มี backend, ไม่มี localStorage/database) — รีโหลดหน้าแล้วข้อมูลจะรีเซ็ตกลับไปเป็น
ข้อมูลตัวอย่าง (mock data) ที่ hardcode ไว้ในโค้ด

## เทคโนโลยีที่ใช้

- **Vanilla HTML/CSS/JavaScript** ล้วน ๆ — ไม่มี build step, ไม่มี framework
  (ไม่ใช้ React/Vue), ไม่มี package.json / npm dependencies
- ฟอนต์ **Sarabun** จาก Google Fonts (โหลดผ่าน `<link>` ใน `<head>`)
- ใช้ `crypto.randomUUID()` ของเบราว์เซอร์สำหรับสร้าง id
- CSS ธรรมดา ใช้ CSS custom properties (`:root { --gold: ...; --ink: ...; }`)
  เป็น design tokens สำหรับโทนสี ไม่มี CSS framework (ไม่ใช่ Tailwind/Bootstrap)
- ไม่มี test suite และไม่มี build/deploy script ใด ๆ ในโปรเจกต์นี้

### วิธีรันดูแอป

เปิดไฟล์ `index.html` ในเบราว์เซอร์ได้ตรง ๆ หรือรันเซิร์ฟเวอร์ static ง่าย ๆ เช่น:

```bash
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000/index.html
```

## โครงสร้างไฟล์

```
natna-app/
├── index.html        # โครงสร้างหน้าเว็บ (markup) ทั้งหมด — ไม่มี inline <style>/<script> แล้ว
├── css/
│   └── style.css      # สไตล์ทั้งหมดของแอป (design tokens, layout, ทุกหน้า/คอมโพเนนต์)
├── js/
│   └── app.js          # ตรรกะแอปทั้งหมด: state, การ render, event handlers
└── assets/
    └── logo.png         # โลโก้ NatNa (แยกออกมาจาก base64 ที่เคย inline อยู่ใน HTML)
```

เดิมโค้ดทั้งหมด (HTML + CSS + JS + โลโก้แบบ base64) อยู่รวมกันในไฟล์ `index.html`
ไฟล์เดียว (~600 บรรทัด) ภายหลังถูกแยกออกเป็นโครงสร้างข้างต้นเพื่อให้ดูแลรักษาง่ายขึ้น
โดย **ไม่มีการเปลี่ยนแปลงฟีเจอร์หรือดีไซน์ใด ๆ** — พฤติกรรมของแอปเหมือนเดิมทุกประการ

### รายละเอียด `js/app.js`

ไฟล์เดียวที่รวม state และฟังก์ชันทั้งหมด แบ่งเป็นส่วน ๆ ด้วยคอมเมนต์ตามลำดับนี้:

- **STATE** — ตัวแปร global: `guideItems`, `appointments` (mock data), `currentApptId`,
  `deleteTargetId`, ตัวแปรสถานะปฏิทิน (`calMonth`, `calYear`, `selectedCalDate`)
- **NAV** — สลับการแสดงผลระหว่างหน้า (`showHome`, `showAddForm`, `showDetail`, `showManage`)
- **Status helper** — คำนวณสถานะนัดหมาย (`apptStatus`) และจัดรูปแบบวันที่ไทย (`fmtDateTh`)
- **Card view** — render รายการนัดหมายเป็นการ์ด (`renderCardView`)
- **Delete confirm** — flow ยืนยันการลบ (`askDelete`, `cancelDelete`, `confirmDelete`)
- **Add appointment** — บันทึกนัดหมายใหม่ (`submitAddForm`)
- **Calendar view** — render ปฏิทินรายเดือนและรายการนัดของวันที่เลือก
  (`renderCalendar`, `renderCalDayList`, `changeMonth`)
- **Detail page (checklist)** — render/แก้ไขเช็คลิสต์และสถานะความพร้อม
  (`renderDetail`, `renderChecklist`, `renderSuggestChips`, `addCustomItem`, `updateStatus`)
- **Manage guide list** — เพิ่ม/ลบรายการแนะนำ (`renderGuideManageList`, `addGuideItem`)

หน้าเว็บทั้งหมดในแอปเป็น `<div>` ที่ซ่อน/แสดงด้วยคลาส `hidden` (single-page app แบบง่าย
ไม่มี router/URL routing) — element id หลักที่แต่ละหน้าใช้คือ `homePage`, `addPage`,
`detailPage`, `managePage`

## หมายเหตุสำหรับการแก้ไขโค้ดครั้งต่อไป

- อย่าใส่ `<style>`/`<script>` แบบ inline กลับเข้าไปใน `index.html` อีก — ให้แก้ที่
  `css/style.css` / `js/app.js` แทนเพื่อรักษาโครงสร้างที่แยกไว้
- ถ้าจะเพิ่มรูปภาพ/ไอคอนใหม่ ให้เก็บไว้ใน `assets/` แทนการฝัง base64 ในโค้ด
- ยังไม่มี persistence — ถ้าจะเพิ่ม (เช่น localStorage หรือ backend จริง) ควรทำเป็นงานแยก
  และคุยกับผู้ใช้ก่อนว่าต้องการ data model แบบไหน
