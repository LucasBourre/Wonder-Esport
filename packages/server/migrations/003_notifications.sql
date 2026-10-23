-- Notifications : ce qui arrive à un joueur de la part des autres (invitation, défi,
-- demande d'ami, vote de salle…). Gardées pour qu'il les retrouve même s'il n'était pas
-- connecté ; le texte affiché est composé par l'interface à partir de `kind` et `payload`.
create table notifications (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on notifications (user_id, created_at desc);
