-- Realtime para DMs (network.js). Se falhar com "already member", a tabela já está ativa.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
