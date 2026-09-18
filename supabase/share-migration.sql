-- NatNa (นัดนะ) — เพิ่มฟีเจอร์ "แชร์ให้ผู้สูงอายุ" (ลิงก์ดูนัดหมาย/ติ๊กเช็คลิสต์ได้โดยไม่ต้อง login)
--
-- วิธีใช้: รันไฟล์นี้ใน Supabase Dashboard → SQL Editor → New query → Run
-- ต้องรัน supabase/schema.sql และ supabase/auth-migration.sql มาก่อนแล้ว (มีตาราง
-- appointments + ระบบ login พร้อม user_id/RLS แล้ว) รันไฟล์นี้ได้ทันที ไม่ต้องรออะไรเพิ่ม
--
-- แนวคิดโดยสรุป:
-- 1) ตาราง profiles — เก็บ "share token" 1 อันต่อบัญชี (สุ่มด้วย gen_random_uuid() อัตโนมัติ
--    ตอนสร้างแถว) ฝั่งแอป (js/app.js: ensureShareToken()) จะสร้างแถวนี้ให้อัตโนมัติตอน
--    login สำเร็จครั้งแรกที่ยังไม่มี ไม่ต้องรันอะไรเพิ่มเองสำหรับบัญชีที่จะสมัครในอนาคต
-- 2) ฟังก์ชัน get_shared_view(token) — endpoint เดียวที่หน้าแชร์ (ไม่ login) เรียกได้ ผ่าน
--    role "anon" คืนเฉพาะนัดหมายของบัญชีที่ token ตรงกันเท่านั้น ถ้า token ผิด/ไม่พบ คืน
--    {"valid": false} ทันที ไม่แตะตาราง appointments เลยแม้แต่น้อย (ไม่เสี่ยงข้อมูลหลุด)
-- 3) ฟังก์ชัน toggle_shared_checklist_item(...) — endpoint เดียวที่หน้าแชร์ใช้ "แก้ไขข้อมูล"
--    ได้ ซึ่งจำกัดไว้แค่สลับ true/false ของฟิลด์ done ในเช็คลิสต์ 1 รายการที่ระบุ id เท่านั้น
--    แก้ข้อความ/เพิ่ม/ลบรายการ หรือแตะนัดหมายอื่นไม่ได้เลยแม้จะเรียก API ตรงๆ เอง (ไม่ใช่แค่
--    ปุ่มในหน้าเว็บที่ซ่อนไว้) เพราะฟังก์ชันเขียน SQL บังคับไว้ในระดับฐานข้อมูล
--
-- ทั้งสองฟังก์ชันเป็น "security definer" (รันด้วยสิทธิ์เจ้าของฟังก์ชัน ซึ่งเป็น postgres/
-- เจ้าของตาราง appointments อยู่แล้ว) จึงข้าม RLS ปกติของ appointments ได้แบบควบคุมได้
-- (ผ่านทางเงื่อนไขที่เขียนไว้ในฟังก์ชันเท่านั้น ไม่ใช่เปิด RLS ให้ anon ตรงๆ)

-- 1) ตาราง profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  share_token text not null unique default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own_select_profile" on public.profiles;
create policy "own_select_profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "own_insert_profile" on public.profiles;
create policy "own_insert_profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

grant select, insert on public.profiles to authenticated;

-- 2) get_shared_view(token) — คืนนัดหมายทั้งหมดของบัญชีที่ token ตรงกัน (เรียงตามวันที่)
--    หรือ {"valid": false} ถ้า token ไม่ถูกต้อง ไม่ใส่ user_id ปนไปในผลลัพธ์ (ไม่จำเป็นต้องรู้)
create or replace function public.get_shared_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_appointments jsonb;
begin
  select id into v_user_id from public.profiles where share_token = p_token;
  if v_user_id is null then
    return jsonb_build_object('valid', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.name, 'place', a.place, 'dept', a.dept,
      'date', a.date, 'time', a.time, 'notifications', a.notifications,
      'checklist', a.checklist
    ) order by a.date), '[]'::jsonb)
    into v_appointments
    from public.appointments a
    where a.user_id = v_user_id;

  return jsonb_build_object('valid', true, 'appointments', v_appointments);
end;
$$;

grant execute on function public.get_shared_view(text) to anon;

-- 3) toggle_shared_checklist_item(token, appt_id, item_id, done) — สลับ done ของรายการ
--    เช็คลิสต์ 1 รายการเท่านั้น (แก้ข้อความ/เพิ่ม/ลบไม่ได้) และต้อง token ตรงกับเจ้าของ
--    นัดหมายนั้นด้วย คืน true ถ้าแก้สำเร็จ (เจอทั้ง token และแถวที่ตรงกัน), false ถ้าไม่เจอ
create or replace function public.toggle_shared_checklist_item(
  p_token text, p_appt_id uuid, p_item_id text, p_done boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_updated int;
begin
  select id into v_user_id from public.profiles where share_token = p_token;
  if v_user_id is null then
    return false;
  end if;

  update public.appointments a
  set checklist = (
    select coalesce(jsonb_agg(
      case when (item->>'id') = p_item_id
        then jsonb_set(item, '{done}', to_jsonb(p_done))
        else item
      end
    ), '[]'::jsonb)
    from jsonb_array_elements(a.checklist) as item
  )
  where a.id = p_appt_id and a.user_id = v_user_id;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.toggle_shared_checklist_item(text, uuid, text, boolean) to anon;
