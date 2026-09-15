-- NatNa (นัดนะ) — schema สำหรับตารางนัดหมายบน Supabase
--
-- วิธีใช้: คัดลอกไฟล์นี้ทั้งหมดไปรันใน Supabase Dashboard → SQL Editor → New query → Run
-- (ต้องรันครั้งเดียวตอนตั้งโปรเจกต์ใหม่ ก่อนเปิดใช้แอปเวอร์ชันที่เชื่อม Supabase)
--
-- หมายเหตุความปลอดภัย: แอปนี้ไม่มีระบบ login — ทุกคนที่เข้าเว็บใช้ anon key เดียวกัน
-- (public, ฝังอยู่ใน js/app.js) นโยบาย RLS ด้านล่างจึงเปิดให้ anon อ่าน/เขียน/ลบได้ทุกแถว
-- หมายความว่าผู้เข้าเว็บทุกคนเห็นและแก้ไขนัดหมายชุดเดียวกันร่วมกันได้ทั้งหมด (เหมาะกับ
-- demo/ใช้งานภายในครอบครัวเดียว ไม่เหมาะกับข้อมูลที่ต้องแยกเป็นความลับต่อผู้ใช้)

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place text not null,
  dept text not null,
  date date not null,
  -- เก็บเป็น text รูปแบบ "HH:MM" ตรงกับที่แอปใช้อยู่แล้ว (ไม่ใช้ time type ของ Postgres
  -- เพราะ PostgREST จะคืนค่ามาเป็น "HH:MM:SS" ทำให้ข้อความที่แสดงผลในแอปเปลี่ยนไป)
  time text not null,
  notifications jsonb not null default '[]'::jsonb,   -- เช่น ["3d","1h"]
  checklist jsonb not null default '[]'::jsonb,        -- เช่น [{"id":"...","text":"...","done":false,"source":"custom"}]
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

drop policy if exists "anon_select_appointments" on public.appointments;
create policy "anon_select_appointments" on public.appointments
  for select to anon using (true);

drop policy if exists "anon_insert_appointments" on public.appointments;
create policy "anon_insert_appointments" on public.appointments
  for insert to anon with check (true);

drop policy if exists "anon_update_appointments" on public.appointments;
create policy "anon_update_appointments" on public.appointments
  for update to anon using (true) with check (true);

drop policy if exists "anon_delete_appointments" on public.appointments;
create policy "anon_delete_appointments" on public.appointments
  for delete to anon using (true);

grant select, insert, update, delete on public.appointments to anon, authenticated;

-- ข้อมูลตัวอย่างเริ่มต้น (ตรงกับ mock data เดิมของแอป) — รันครั้งเดียวตอนตาราง
-- ยังว่างอยู่ ถ้าไม่ต้องการข้อมูลตัวอย่างให้ลบส่วนนี้ทิ้งก่อนรัน หรือรันแล้วลบทีหลังในแอปได้
insert into public.appointments (name, place, dept, date, time, notifications, checklist)
select * from (values
  ('คุณยายสมศรี ใจดี', 'โรงพยาบาลศิริราช', 'แผนกอายุรกรรม', '2026-09-11'::date, '09:30',
    '[]'::jsonb,
    '[{"id":"seed-1","text":"พกบัตรประชาชน / บัตรโรงพยาบาล","done":false,"source":"custom"},{"id":"seed-2","text":"พกยาที่กินอยู่ประจำ","done":false,"source":"custom"}]'::jsonb),
  ('คุณตาประยุทธ์ มั่นคง', 'โรงพยาบาลรามาธิบดี', 'แผนกหัวใจ', '2026-09-20'::date, '13:00', '[]'::jsonb, '[]'::jsonb),
  ('คุณป้าวันเพ็ญ สุขใจ', 'โรงพยาบาลจุฬาลงกรณ์', 'แผนกตา', '2026-08-30'::date, '10:15', '[]'::jsonb, '[]'::jsonb),
  ('คุณลุงสมชาย รุ่งเรือง', 'โรงพยาบาลศิริราช', 'แผนกกระดูก', '2026-10-05'::date, '14:30', '[]'::jsonb, '[]'::jsonb)
) as seed(name, place, dept, date, time, notifications, checklist)
where not exists (select 1 from public.appointments);
