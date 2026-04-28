# E2E Smoke Checklist (Produção)

## 1) Navegação Base
- Abrir site e validar carregamento da Home sem erro no console.
- Clicar nas abas Home, Produtos, Comunidade, Network e voltar para Home.
- Validar que o indicador de aba acompanha a aba ativa.

## 2) Home CTAs
- Botão `Acessar Catálogo Grátis` abre aba `Produtos`.
- Botão `Falar com Consultora` da Home abre modal de solicitação.
- Botão `Solicitar demonstração` abre modal de solicitação.

## 3) Produtos
- Categorias em bolhas renderizam com imagem e nome.
- Modal aceita nome, telefone, quantidade e imagem.
- Envio retorna QR + botão de WhatsApp.
- Repetir 3 envios e confirmar sorteio entre 3 vendedoras ativas.

## 4) Comunidade
- Carregar notícias via `community_articles` (Supabase).
- Validar badge de atualização e categorias.
- Se tabela estiver vazia, exibir fallback editorial sem quebrar layout.

## 5) Network
- Entrar logado e validar feed, like e comentário.
- Publicar post com e sem imagem.
- Abrir mensagens e alternar conversa.
- Confirmar que o fundo da aba está limpo (sem overlay de logo).

## 6) Regressão Visual
- Conferir contraste de texto nas seções principais.
- Verificar que logos animadas não aparecem na aba Network.
- Testar responsivo em largura mobile (<= 768px).

## 7) Sanidade de Build
- Executar `npm run build`.
- Executar `npm run preview`.
- Abrir site em preview e repetir passos 1 e 2.
