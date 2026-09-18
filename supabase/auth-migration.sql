-- NatNa (นัดนะ) — เพิ่มระบบ login (Supabase Auth: อีเมล + รหัสผ่าน) ให้ตาราง appointments
--
-- วิธีใช้: รันไฟล์นี้ใน Supabase Dashboard → SQL Editor → New query → Run
-- ต้องรัน supabase/schema.sql มาก่อนแล้ว (สร้างตาราง appointments ไว้แล้ว) — ไฟล์นี้รันได้
-- ทันที ไม่ต้องรอสมัครบัญชีในแอปก่อน แล้วค่อยรัน supabase/auth-backfill.sql ทีหลังหลังจาก
-- สมัครบัญชีแรกในแอปเรียบร้อยแล้ว (มอบข้อมูลตัวอย่างเดิม 4 รายการให้เป็นของบัญชีนั้น)
--
-- สิ่งที่ไฟล์นี้ทำ:
-- 1) เพิ่มคอลัมน์ user_id ผูกนัดหมายแต่ละแถวเข้ากับบัญชีที่สร้าง (nullable ชั่วคราวก่อน
--    เพราะข้อมูลตัวอย่างเดิม 4 รายการยังไม่มีเจ้าของ จนกว่าจะรัน auth-backfill.sql)
-- 2) ตั้งค่า default ของ user_id เป็น auth.uid() — แอปฝั่ง JS จึงไม่ต้องส่ง user_id เอง
--    ตอนเพิ่มนัดใหม่เลย ฐานข้อมูลใส่ให้อัตโนมัติจากบัญชีที่ login อยู่ตอนนั้น
-- 3) ลบ policy เดิมที่เปิดให้ role "anon" (ยังไม่ login) เข้าถึงได้ทุกแถว เพราะตอนนี้มีระบบ
--    login แล้ว ไม่ควรให้ใครก็ได้ที่ยังไม่ login อ่าน/เขียนข้อมูลได้อีกต่อไป
-- 4) สร้าง policy ใหม่: เฉพาะ role "authenticated" (login แล้ว) เท่านั้นที่เข้าถึงได้ และ
--    เห็น/แก้ไข/ลบได้เฉพาะแถวที่ user_id ตรงกับบัญชีตัวเอง (auth.uid()) เท่านั้น ไม่เห็นของคนอื่น

alter table public.appointments
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.appointments alter column user_id set default auth.uid();

-- ลบ policy เดิมของโหมด anon (ก่อนมีระบบ login) ทิ้งทั้งหมด
drop policy if exists "anon_select_appointments" on public.appointments;
drop policy if exists "anon_insert_appointments" on public.appointments;
drop policy if exists "anon_update_appointments" on public.appointments;
drop policy if exists "anon_delete_appointments" on public.appointments;
revoke select, insert, update, delete on public.appointments from anon;

-- policy ใหม่: authenticated เท่านั้น + เห็น/แก้ไข/ลบได้เฉพาะของตัวเอง
drop policy if exists "own_select_appointments" on public.appointments;
create policy "own_select_appointments" on public.appointments
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own_insert_appointments" on public.appointments;
create policy "own_insert_appointments" on public.appointments
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own_update_appointments" on public.appointments;
create policy "own_update_appointments" on public.appointments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own_delete_appointments" on public.appointments;
create policy "own_delete_appointments" on public.appointments
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.appointments to authenticated;

-- หมายเหตุ: นัดหมาย 4 รายการตัวอย่างเดิม (seed จาก schema.sql) จะมี user_id เป็น null อยู่
-- ชั่วคราว ซึ่งตอนนี้จะ "มองไม่เห็นจากบัญชีไหนเลย" เพราะ policy ใหม่กรองด้วย
-- user_id = auth.uid() เสมอ (null ไม่มีทาง match ได้) — ข้อมูลไม่ได้หายไปไหน แค่ถูกซ่อนไว้
-- จนกว่าจะรัน supabase/auth-backfill.sql มอบให้เป็นของบัญชีแรกที่สมัคร
