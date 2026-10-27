-- Unified master schema mirror for the EventSelfSolutions platform.
-- This file is intentionally kept in sync conceptually with apps/api/prisma/schema.prisma,
-- and should be treated as the migration baseline for downstream database tooling.

CREATE TYPE role AS ENUM ('CLIENT', 'VENDOR', 'RIDER', 'CONSULTANT', 'ADMIN');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');
CREATE TYPE verification_status AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE listing_type AS ENUM ('VENUE', 'GOOD', 'SERVICE');
CREATE TYPE listing_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE event_type AS ENUM ('PERSONAL', 'CORPORATE', 'SOCIAL', 'SPORTS', 'CULTURAL', 'RELIGIOUS', 'POLITICAL', 'ENTERTAINMENT', 'EDUCATIONAL', 'VIRTUAL');
CREATE TYPE event_status AS ENUM ('DRAFT', 'PLANNING', 'LIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE rsvp_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'MAYBE');
CREATE TYPE task_status AS ENUM ('TODO', 'DOING', 'DONE');
CREATE TYPE booking_status AS ENUM ('PENDING', 'PAID', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'DISPUTED', 'REFUNDED');
CREATE TYPE ledger_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'COMMISSION', 'SUBSCRIPTION', 'ADJUSTMENT');
CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
CREATE TYPE billing_interval AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE promotion_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE dispatch_status AS ENUM ('REQUESTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED');

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role role NOT NULL DEFAULT 'CLIENT',
  status user_status NOT NULL DEFAULT 'ACTIVE',
  locale TEXT NOT NULL DEFAULT 'en',
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type event_type NOT NULL DEFAULT 'PERSONAL',
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  venue_id UUID,
  country TEXT,
  city TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  expected_guests INTEGER,
  status event_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guests (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  rsvp rsvp_status NOT NULL DEFAULT 'PENDING',
  plus_ones INTEGER NOT NULL DEFAULT 0,
  token TEXT NOT NULL,
  responded_at TIMESTAMPTZ
);

CREATE TABLE event_tasks (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  status task_status NOT NULL DEFAULT 'TODO',
  is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE budget_items (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  planned_minor BIGINT NOT NULL DEFAULT 0,
  actual_minor BIGINT NOT NULL DEFAULT 0
);
