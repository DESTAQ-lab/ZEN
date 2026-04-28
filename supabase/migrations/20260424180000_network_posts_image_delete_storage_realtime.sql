-- Feed Network: imagem no post, exclusão pelo autor, bucket post-images, realtime likes/posts

ALTER TABLE public.network_posts
  ADD COLUMN IF NOT EXISTS image_url text;

DROP POLICY IF EXISTS "Autor apaga post" ON public.network_posts;
CREATE POLICY "Autor apaga post"
ON public.network_posts
FOR DELETE
USING (
  author_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "post_images_select_public" ON storage.objects;
CREATE POLICY "post_images_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "post_images_insert_own_folder" ON storage.objects;
CREATE POLICY "post_images_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "post_images_update_own_folder" ON storage.objects;
CREATE POLICY "post_images_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "post_images_delete_own_folder" ON storage.objects;
CREATE POLICY "post_images_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DO $pub$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.network_posts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$pub$;

DO $pub2$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$pub2$;
