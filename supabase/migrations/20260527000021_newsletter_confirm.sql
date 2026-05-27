-- Newsletter double opt-in: confirmation token + activation status
alter table public.newsletter_subscribers
  add column if not exists confirmation_token text,
  add column if not exists confirmed_at timestamptz;

-- New subscribers default to inactive until confirmed
-- Existing active subscribers stay active (they signed up via single opt-in earlier)

create index if not exists idx_newsletter_token
  on public.newsletter_subscribers(confirmation_token)
  where confirmation_token is not null;
