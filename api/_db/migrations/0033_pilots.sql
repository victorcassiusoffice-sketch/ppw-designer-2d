CREATE TABLE pilots (
 id uuid PRIMARY KEY, slug varchar(80) NOT NULL UNIQUE, owner_id varchar(80) NOT NULL,
 name varchar(160) NOT NULL, lane varchar(160) NOT NULL, state varchar(24) NOT NULL,
 summary varchar(500) NOT NULL DEFAULT '', public_summary boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), created timestamptz NOT NULL DEFAULT now(), updated timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pilots_owner ON pilots(owner_id);
CREATE TABLE pilot_members (
 id varchar(80) NOT NULL, pilot_id uuid NOT NULL REFERENCES pilots(id), role varchar(32) NOT NULL,
 first_name varchar(160) NOT NULL, organisation varchar(160) NOT NULL, state varchar(12) NOT NULL,
 invite_hash char(64), invite_expires timestamptz, cookie_key_hash char(64), cookie_expires timestamptz, created timestamptz NOT NULL DEFAULT now(), last_seen timestamptz,
 PRIMARY KEY(pilot_id,id)
);
CREATE INDEX pilot_members_cookie ON pilot_members(cookie_key_hash) WHERE cookie_key_hash IS NOT NULL;
CREATE TABLE pilot_items (
 id varchar(80) NOT NULL,pilot_id uuid NOT NULL REFERENCES pilots(id),kind varchar(16) NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<16000),
 created_by varchar(80) NOT NULL, created timestamptz NOT NULL DEFAULT now(),updated timestamptz NOT NULL DEFAULT now(),hidden boolean NOT NULL DEFAULT false,
 PRIMARY KEY(pilot_id,id)
);
CREATE INDEX pilot_items_by_kind ON pilot_items(pilot_id,kind);
