-- Fix DM RLS recursion on conversation_participants
-- Moves participant checks to a SECURITY DEFINER function in private schema.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_conversation_participant(target_conversation uuid, target_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = target_conversation
      AND cp.user_id = target_user
  );
$$;

REVOKE ALL ON FUNCTION private.is_conversation_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_conversation_participant(uuid, uuid) TO authenticated, service_role;

-- conversations
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (private.is_conversation_participant(conversations.id, auth.uid()));

-- participants
DROP POLICY IF EXISTS "conversation_participants_select_my_conversations" ON public.conversation_participants;
CREATE POLICY "conversation_participants_select_my_conversations"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (private.is_conversation_participant(conversation_participants.conversation_id, auth.uid()));

DROP POLICY IF EXISTS "conversation_participants_insert_self_or_inviter" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert_self_or_inviter"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR private.is_conversation_participant(conversation_participants.conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "conversation_participants_update_own_last_read" ON public.conversation_participants;
CREATE POLICY "conversation_participants_update_own_last_read"
  ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (private.is_conversation_participant(messages.conversation_id, auth.uid()));

DROP POLICY IF EXISTS "messages_insert_sender_participant" ON public.messages;
CREATE POLICY "messages_insert_sender_participant"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND private.is_conversation_participant(messages.conversation_id, auth.uid())
  );
