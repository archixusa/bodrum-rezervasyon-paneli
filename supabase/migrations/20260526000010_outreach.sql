-- =========================================================================
-- FAZ 8 — B2B Partnership Outreach
-- =========================================================================
-- KVKK uyumu: sadece tüzel kişi/işletme adresleri. Unsubscribe link zorunlu.
-- Domain başına günlük gönderim limiti + warm-up.
-- =========================================================================

create table public.outreach_targets (
  id              uuid primary key default gen_random_uuid(),
  company_name    text not null,
  contact_name    text,
  email           text not null,
  phone           text,
  website         text,
  category        text,
  region          text,
  notes           text,
  source          text default 'manual'
                    check (source in ('manual','google_maps','web_search','referral')),
  status          text default 'new'
                    check (status in ('new','queued','contacted','replied','converted','unsubscribed','bounced','suppressed')),
  language        text default 'tr',
  custom_fields   jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(email)
);

create index outreach_targets_status_idx on public.outreach_targets (status);
create index outreach_targets_category_idx on public.outreach_targets (category);

create table public.outreach_sequences (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  is_active       boolean default true,
  steps           jsonb not null,    -- [{day:0, subject:"...", body:"..."}, ...]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.outreach_enrollments (
  id              uuid primary key default gen_random_uuid(),
  target_id       uuid references public.outreach_targets(id) on delete cascade,
  sequence_id     uuid references public.outreach_sequences(id) on delete cascade,
  started_at      timestamptz default now(),
  current_step    int default 0,
  next_send_at    timestamptz,
  status          text default 'active'
                    check (status in ('active','paused','completed','stopped'))
);

create index oe_next_send_idx on public.outreach_enrollments (next_send_at) where status = 'active';
create index oe_target_idx on public.outreach_enrollments (target_id);

create table public.outreach_send_log (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid references public.outreach_enrollments(id) on delete cascade,
  target_id       uuid references public.outreach_targets(id) on delete cascade,
  step_index      int not null,
  subject         text not null,
  body_preview    text,
  status          text not null check (status in ('queued','sent','bounced','failed','suppressed')),
  resend_id       text,
  error_message   text,
  sent_at         timestamptz default now()
);

create index osl_status_idx on public.outreach_send_log (status);
create index osl_target_idx on public.outreach_send_log (target_id);

create table public.outreach_suppression (
  email           text primary key,
  reason          text,
  added_at        timestamptz default now()
);

create table public.outreach_daily_limits (
  date            date primary key,
  sends_count     int not null default 0,
  warmup_cap      int not null default 5
);

-- updated_at
create trigger outreach_targets_set_updated_at
  before update on public.outreach_targets for each row execute function public.set_updated_at();
create trigger outreach_sequences_set_updated_at
  before update on public.outreach_sequences for each row execute function public.set_updated_at();

-- RLS
alter table public.outreach_targets       enable row level security;
alter table public.outreach_sequences     enable row level security;
alter table public.outreach_enrollments   enable row level security;
alter table public.outreach_send_log      enable row level security;
alter table public.outreach_suppression   enable row level security;
alter table public.outreach_daily_limits  enable row level security;

create policy "Admin full outreach_targets"      on public.outreach_targets      for all to authenticated using (true) with check (true);
create policy "Admin full outreach_sequences"    on public.outreach_sequences    for all to authenticated using (true) with check (true);
create policy "Admin full outreach_enrollments"  on public.outreach_enrollments  for all to authenticated using (true) with check (true);
create policy "Admin full outreach_send_log"     on public.outreach_send_log     for all to authenticated using (true) with check (true);
create policy "Admin full outreach_suppression"  on public.outreach_suppression  for all to authenticated using (true) with check (true);
create policy "Admin full outreach_daily_limits" on public.outreach_daily_limits for all to authenticated using (true) with check (true);

-- Public can insert into suppression (unsubscribe link)
create policy "Anon insert suppression" on public.outreach_suppression for insert to anon with check (true);

grant select, insert, update, delete on public.outreach_targets      to authenticated;
grant select, insert, update, delete on public.outreach_sequences    to authenticated;
grant select, insert, update, delete on public.outreach_enrollments  to authenticated;
grant select, insert, update, delete on public.outreach_send_log     to authenticated;
grant select, insert, update, delete on public.outreach_suppression  to authenticated;
grant select, insert, update, delete on public.outreach_daily_limits to authenticated;
grant insert on public.outreach_suppression to anon;

-- Default sequence: 4-step partnership outreach
insert into public.outreach_sequences (name, description, steps) values (
  'B2B Partnership Standard',
  'Bodrum bölgesindeki turizm ortakları için 4 adımlı outreach (0/5/10/18 gün)',
  '[
    {
      "day": 0,
      "subject": "Bodrum’da partnership önerisi — {company_name}",
      "body": "Merhaba {contact_name},\n\nBodrumapartkiralama.com olarak Bodrum yarımadasında 50+ apart/villa portföyü yönetiyoruz. Yıllık 15.000+ misafire dokunuyoruz.\n\n{company_name} ile karşılıklı referans/komisyon modeli üzerine kısa bir görüşme yapabilir miyiz? Sizin müşterileriniz konaklama ararken, bizim misafirlerimiz de sizin hizmetinize ihtiyaç duyabilir.\n\nUygun musunuz?\n\nFurkan Şahin\n+90 538 512 40 88"
    },
    {
      "day": 5,
      "subject": "Re: Partnership önerisi",
      "body": "Merhaba {contact_name},\n\nGeçen haftaki notuma dönüş için kısa hatırlatma. {company_name} ile partnership görüşmesi için 20 dakikalık bir online toplantı veya bir kahve uygun olur mu?\n\nFurkan"
    },
    {
      "day": 10,
      "subject": "Son hatırlatma — Bodrum partnership",
      "body": "Merhaba {contact_name},\n\nSon iki notum yanıtsız kaldı. Belki yoğunsunuz — anlıyorum.\n\nSadece ilgi durumuzu öğrenebilir miyim? Cevap istemiyorsanız bu maili görmezden gelin, bir daha rahatsız etmem.\n\nFurkan"
    },
    {
      "day": 18,
      "subject": "Yıl sonu özel: %20 indirim referans + ücretsiz konaklama gecesi",
      "body": "Merhaba {contact_name},\n\nYıl sonuna kadar başlatılan partnership’larda misafirlerinize özel %20 indirim kodu ve ayrıca {company_name}’in ekibi için yılda 2 ücretsiz konaklama gecesi sunuyoruz.\n\nSon teklif. İlgilenmezseniz bu konuda bir daha dönüş yapmayacağım. Saygılarımla.\n\nFurkan"
    }
  ]'::jsonb
);
