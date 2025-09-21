create table public.encrypted_memories (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  ciphertext text not null,
  wrapped_dek text not null,
  dek_salt text not null,
  dek_iv text not null,
  data_iv text not null,
  kdf_algorithm text not null default 'pbkdf2'::text,
  kdf_iterations integer not null default 100000,
  encryption_algorithm text not null default 'aes-256-gcm'::text,
  encrypted_keywords text[] null,
  keyword_hints text[] null,
  content_type text null default 'text/plain'::text,
  content_length integer null,
  is_encrypted boolean null default true,
  version integer null default 1,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint encrypted_memories_pkey primary key (id),
  constraint encrypted_memories_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint positive_content_length check ((content_length >= 0)),
  constraint positive_iterations check ((kdf_iterations > 0)),
  constraint valid_encryption_algorithm check ((encryption_algorithm = 'aes-256-gcm'::text)),
  constraint valid_kdf_algorithm check (
    (
      kdf_algorithm = any (array['pbkdf2'::text, 'argon2id'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists encrypted_memories_user_id_idx on public.encrypted_memories using btree (user_id) TABLESPACE pg_default;

create index IF not exists encrypted_memories_created_at_idx on public.encrypted_memories using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists encrypted_memories_keywords_idx on public.encrypted_memories using gin (encrypted_keywords) TABLESPACE pg_default;

create trigger update_encrypted_memories_updated_at BEFORE
update on encrypted_memories for EACH row
execute FUNCTION update_updated_at_column ();

create table public.user_encryption_profiles (
  user_id uuid not null,
  kdf_algorithm text not null default 'pbkdf2'::text,
  kdf_iterations integer not null default 100000,
  master_salt text not null,
  require_passphrase_verification boolean null default true,
  auto_logout_minutes integer null default 30,
  max_failed_attempts integer null default 5,
  recovery_hint text null,
  is_new boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  last_passphrase_change timestamp with time zone null default now(),
  constraint user_encryption_profiles_pkey primary key (user_id),
  constraint user_encryption_profiles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint positive_profile_iterations check ((kdf_iterations > 0)),
  constraint valid_auto_logout check (
    (
      (auto_logout_minutes >= 5)
      and (auto_logout_minutes <= 1440)
    )
  ),
  constraint valid_profile_kdf_algorithm check (
    (
      kdf_algorithm = any (array['pbkdf2'::text, 'argon2id'::text])
    )
  )
) TABLESPACE pg_default;

create trigger update_user_encryption_profiles_updated_at BEFORE
update on user_encryption_profiles for EACH row
execute FUNCTION update_updated_at_column ();