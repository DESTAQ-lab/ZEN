-- Trigger helpers: search_path fix (security advisor)
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.network_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.network_posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.network_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.network_posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$function$;

-- Foreign key covering indexes (performance advisor)
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_network_posts_author_id ON public.network_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author_id ON public.post_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes (user_id);

-- RLS: (select auth.uid()) initplan pattern + ownership checks
DROP POLICY IF EXISTS "Usuário edita próprio perfil" ON public.profiles;
CREATE POLICY "Usuário edita próprio perfil"
ON public.profiles
FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Autenticado cria post" ON public.network_posts;
CREATE POLICY "Autenticado cria post"
ON public.network_posts
FOR INSERT
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND author_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Autor edita post" ON public.network_posts;
CREATE POLICY "Autor edita post"
ON public.network_posts
FOR UPDATE
USING (
  author_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  author_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Autenticado curte" ON public.post_likes;
CREATE POLICY "Autenticado curte"
ON public.post_likes
FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Descurtir próprio" ON public.post_likes;
CREATE POLICY "Descurtir próprio"
ON public.post_likes
FOR DELETE
USING (
  user_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Autenticado comenta" ON public.post_comments;
CREATE POLICY "Autenticado comenta"
ON public.post_comments
FOR INSERT
WITH CHECK (
  author_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Autenticado segue" ON public.follows;
CREATE POLICY "Autenticado segue"
ON public.follows
FOR INSERT
WITH CHECK (
  follower_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Desseguir próprio" ON public.follows;
CREATE POLICY "Desseguir próprio"
ON public.follows
FOR DELETE
USING (
  follower_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

-- Leads B2B: validação explícita no lugar de WITH CHECK (true)
DROP POLICY IF EXISTS "Permitir inserções anônimas para formulário B2B" ON public.leads;
CREATE POLICY "Permitir inserções anônimas para formulário B2B"
ON public.leads
FOR INSERT
WITH CHECK (
  length(trim(both from nome)) >= 2
  AND length(trim(both from email)) >= 5
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND length(trim(both from whatsapp)) >= 10
  AND length(trim(both from empresa)) >= 2
);
;
