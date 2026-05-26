-- =========================================================================
-- Pre-launch: newsletter subscribers + contact messages
-- =========================================================================
-- Two public-facing tables that accept anonymous INSERTs from site forms.
-- Both gated by the IP rate-limit trigger (20260526000018) and read-only
-- to admins.
-- =========================================================================

-- ---------- newsletter_subscribers --------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source_site text not null check (source_site in (
    'bodrumapartkiralama','bodrumapartvilla','bodruminsaatadilat','bodrumacilsu'
  )),
  source_page text,
  ip_address text,
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz,
  is_active boolean default true,
  email_id text
);

create unique index if not exists newsletter_subscribers_email_site
  on public.newsletter_subscribers(lower(email), source_site);

create index if not exists idx_newsletter_active
  on public.newsletter_subscribers(source_site, is_active)
  where is_active = true;

create index if not exists idx_newsletter_subscribed_at
  on public.newsletter_subscribers(subscribed_at desc);

alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

create policy "Auth read newsletter"
  on public.newsletter_subscribers
  for select
  to public
  using (auth.uid() is not null);

create policy "Auth update newsletter"
  on public.newsletter_subscribers
  for update
  to public
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

grant insert on public.newsletter_subscribers to anon;

-- ---------- contact_messages --------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  source_site text not null check (source_site in (
    'bodrumapartkiralama','bodrumapartvilla','bodruminsaatadilat','bodrumacilsu'
  )),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  ip_address text,
  user_agent text,
  status text default 'new' check (status in ('new','replied','closed','spam')),
  internal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contact_status_created
  on public.contact_messages(status, created_at desc);

create index if not exists idx_contact_site
  on public.contact_messages(source_site);

drop trigger if exists trg_contact_updated_at on public.contact_messages;
create trigger trg_contact_updated_at
  before update on public.contact_messages
  for each row execute procedure public.set_updated_at();

alter table public.contact_messages enable row level security;

create policy "Anyone can send contact message"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

create policy "Auth full contact_messages"
  on public.contact_messages
  for all
  to public
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

grant insert on public.contact_messages to anon;

-- Rate-limit trigger (uses existing enforce_anon_rate_limit function)
drop trigger if exists trg_anon_rate_newsletter on public.newsletter_subscribers;
create trigger trg_anon_rate_newsletter
  before insert on public.newsletter_subscribers
  for each row execute procedure public.enforce_anon_rate_limit();

drop trigger if exists trg_anon_rate_contact on public.contact_messages;
create trigger trg_anon_rate_contact
  before insert on public.contact_messages
  for each row execute procedure public.enforce_anon_rate_limit();

-- Realtime
alter publication supabase_realtime add table public.newsletter_subscribers;
alter publication supabase_realtime add table public.contact_messages;

-- Update the rate-limit function to handle these tables
create or replace function public.enforce_anon_rate_limit()
returns trigger
language plpgsql
security definer
as $$
declare
  v_ip text;
  v_allowed boolean;
begin
  if auth.uid() is not null then
    return new;
  end if;

  v_ip := case TG_TABLE_NAME
    when 'reservation_requests'   then new.ip_address
    when 'owner_applications'     then new.ip_address
    when 'outreach_suppression'   then new.ip_address
    when 'newsletter_subscribers' then new.ip_address
    when 'contact_messages'       then new.ip_address
    else null
  end;

  v_allowed := public.check_anon_rate(TG_TABLE_NAME, v_ip);
  if not v_allowed then
    raise exception 'rate_limit_exceeded'
      using errcode = '54000',
            hint = 'Too many submissions from this IP. Please try again later.';
  end if;
  return new;
end;
$$;

-- ---------- Webhook trigger for newsletter ------------------------------
create or replace function public.notify_new_newsletter_subscriber()
returns trigger
language plpgsql
security definer
as $$
declare
  v_secret text;
begin
  v_secret := private.get_webhook_secret();
  perform net.http_post(
    url := 'https://ddnigdorbnvnubjejzfu.supabase.co/functions/v1/notify-newsletter-subscriber',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists newsletter_subscribers_notify on public.newsletter_subscribers;
create trigger newsletter_subscribers_notify
  after insert on public.newsletter_subscribers
  for each row execute function public.notify_new_newsletter_subscriber();
