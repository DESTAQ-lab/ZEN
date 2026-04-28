DROP POLICY IF EXISTS "Usuário cria próprio perfil" ON public.profiles;

-- Cadastro Network: insert de perfil após auth.signUp (network.js)
CREATE POLICY "Usuário cria próprio perfil"
ON public.profiles
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);
