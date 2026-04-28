-- Permite cadastro: usuário autenticado cria a própria linha em profiles (coerente com network.js signUp)
CREATE POLICY "Usuário cria próprio perfil"
ON public.profiles
FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);
;
