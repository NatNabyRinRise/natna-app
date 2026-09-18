-- NatNa (นัดนะ) — มอบนัดหมายตัวอย่างเดิม 4 รายการให้เป็นของบัญชีแรกที่สมัคร
--
-- วิธีใช้: รันไฟล์นี้ "หลังจาก" ทำสองอย่างนี้เรียบร้อยแล้วเท่านั้น
--   1) รัน supabase/auth-migration.sql แล้ว (เพิ่มคอลัมน์ user_id + RLS ใหม่)
--   2) สมัครบัญชีแรกในแอป NatNa เรียบร้อยแล้ว (ผ่านหน้า "สมัครที่นี่")
-- ถ้ายังไม่สมัครบัญชีเลย ไฟล์นี้จะไม่มีอะไรให้มอบ (จะไม่ error แต่ก็จะไม่ backfill อะไรเลย)
-- รันซ้ำได้อย่างปลอดภัย (จะข้ามแถวที่มอบเจ้าของไปแล้ว เพราะกรองด้วย user_id is null เสมอ)

update public.appointments
set user_id = (select id from auth.users order by created_at asc limit 1)
where user_id is null;

-- (ไม่บังคับ) ถ้าอยากบังคับว่าทุกแถวต้องมีเจ้าของเสมอนับจากนี้ไป (กันลืม backfill ในอนาคต)
-- ให้เอาคอมเมนต์ -- ออกจากบรรทัดด้านล่างนี้แล้วรันแยกต่างหากอีกครั้ง — รันได้ก็ต่อเมื่อไม่มี
-- แถวไหนเหลือ user_id เป็น null แล้วเท่านั้น (เช็คด้วย select ก่อนได้: select count(*) from
-- public.appointments where user_id is null; ต้องได้ 0) มิเช่นนั้นคำสั่งนี้จะ error:
--
-- alter table public.appointments alter column user_id set not null;
