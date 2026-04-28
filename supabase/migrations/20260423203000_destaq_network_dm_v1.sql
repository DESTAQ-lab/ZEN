-- Destaq Network DM Migration v1
-- Mensagens diretas: conversations, conversation_participants, messages + RLS + trigger updated_at
--
-- Fluxo de bootstrap (cliente): INSERT conversations → INSERT participants (você) →
-- INSERT participants (outro, só se já for participante da conversa) → INSERT messages.
-- INSERT em conversations exige utilizador autenticado (não há participantes antes da primeira linha).

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.conversations IS 'DM: metadados da conversa (2+ utilizadores via participants).';
COMMENT ON TABLE public.conversation_participants IS 'DM: quem pertence a cada conversa.';
COMMENT ON TABLE public.messages IS 'DM: mensagens por conversa.';

-- ---------------------------------------------------------------------------
-- 2) Índices
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
    ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id
    ON public.conversation_participants (user_id);

-- ---------------------------------------------------------------------------
-- 3) Função + trigger: atualizar conversations.updated_at ao inserir mensagem
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_message_touch_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_touch_conversation_updated_at ON public.messages;

CREATE TRIGGER trg_messages_touch_conversation_updated_at
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_message_touch_conversation_updated_at();

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- conversations: ver só conversas em que participo
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
    ON public.conversations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversations.id
              AND cp.user_id = (SELECT auth.uid())
        )
    );

-- Criar conversa: utilizador autenticado (antes de existir qualquer participant na linha)
DROP POLICY IF EXISTS "conversations_insert_authenticated" ON public.conversations;
CREATE POLICY "conversations_insert_authenticated"
    ON public.conversations
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- participants: ver todas as linhas das conversas em que participo (lista de pares na mesma DM)
DROP POLICY IF EXISTS "conversation_participants_select_my_conversations" ON public.conversation_participants;
CREATE POLICY "conversation_participants_select_my_conversations"
    ON public.conversation_participants
    FOR SELECT
    TO authenticated
    USING (
        conversation_id IN (
            SELECT cp2.conversation_id
            FROM public.conversation_participants cp2
            WHERE cp2.user_id = (SELECT auth.uid())
        )
    );

-- Adicionar-se a si OU já ser participante e adicionar outro utilizador à mesma conversa
DROP POLICY IF EXISTS "conversation_participants_insert_self_or_inviter" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert_self_or_inviter"
    ON public.conversation_participants
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversation_participants.conversation_id
              AND cp.user_id = (SELECT auth.uid())
        )
    );

-- last_read_at: só o próprio utilizador atualiza a sua linha
DROP POLICY IF EXISTS "conversation_participants_update_own_last_read" ON public.conversation_participants;
CREATE POLICY "conversation_participants_update_own_last_read"
    ON public.conversation_participants
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- messages: ler só se participante da conversa
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.conversation_participants cp
            WHERE cp.conversation_id = messages.conversation_id
              AND cp.user_id = (SELECT auth.uid())
        )
    );

-- messages: enviar só como remetente = auth.uid() e tendo de ser participante
DROP POLICY IF EXISTS "messages_insert_sender_participant" ON public.messages;
CREATE POLICY "messages_insert_sender_participant"
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1
            FROM public.conversation_participants cp
            WHERE cp.conversation_id = messages.conversation_id
              AND cp.user_id = (SELECT auth.uid())
        )
    );

-- Soft delete: só o remetente pode atualizar a própria mensagem (ex.: is_deleted)
DROP POLICY IF EXISTS "messages_update_sender_soft_delete" ON public.messages;
CREATE POLICY "messages_update_sender_soft_delete"
    ON public.messages
    FOR UPDATE
    TO authenticated
    USING (sender_id = (SELECT auth.uid()))
    WITH CHECK (sender_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 5) Permissões (Supabase: role authenticated precisa de acesso explícito às novas tabelas)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;

GRANT ALL ON public.conversations TO service_role;
GRANT ALL ON public.conversation_participants TO service_role;
GRANT ALL ON public.messages TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Realtime (opcional; descomente se quiser push de novas mensagens no cliente)
-- ---------------------------------------------------------------------------
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
