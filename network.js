/**
 * DestaQ Network — feed (LinkedIn) + DMs (WhatsApp Web), tema dark.
 * Depende: Supabase JS, window.supabaseClient (auth.js / script.js), openAuthModal (auth.js).
 */
(function () {
  'use strict';

  function safeErrMsg(err) {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err.message != null) return String(err.message);
    return '';
  }
  function logNetworkErr(tag, err) {
    if (import.meta.env.DEV) console.error(tag, err);
    else {
      const m = safeErrMsg(err);
      if (m) console.error(tag, m);
      else console.error(tag);
    }
  }
  function logNetworkWarn(tag, err) {
    if (import.meta.env.DEV) console.warn(tag, err);
    else {
      const m = safeErrMsg(err);
      if (m) console.warn(tag, m);
      else console.warn(tag);
    }
  }

  /** Cache dos primeiros posts (filtro «all», página 0) para não rebuscar ao trocar de aba na mesma sessão. */
  let feedCache = null;

  function invalidateFeedCache() {
    feedCache = null;
  }

  function getClient() {
    if (typeof window.DESTAQ_getSupabaseClient === 'function') {
      const c = window.DESTAQ_getSupabaseClient();
      if (c) return c;
    }
    if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;
    return null;
  }

  let networkState = {
    currentUser: null,
    currentProfile: null,
    posts: [],
    isLoading: false,
    hasMore: true,
    page: 0,
    _loadMoreCooldown: 0,
    activeFilter: 'all',
    likedPostIds: new Set(),
    activeCenter: 'feed',
    selectedConversationId: null,
    /** Canais Realtime por conversationId: { messages, presence } */
    realtimeChannels: {},
    conversationIdSet: new Set(),
    _dmListChannel: null,
    _subscribedChatConvId: null,
    chatPeerUserId: null,
    chatPeerProfileId: null,
    _typingTrackTimer: null,
    _typingDebounceTimer: null,
    _typingClearTimer: null,
    _chatInputAbort: null,
    conversations: [],
    mobileTab: 'feed',
    _authListenerBound: false,
    _destaqListenerBound: false,
    _realtimeChannel: null,
    _ioObserver: null,
    _dmSearchDebounce: null,
    _offlineListenersBound: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    _dmTablesMissingWarned: false,
    profileCollapsed: true,
    profileMenuOpen: false,
    _pendingLikePostIds: new Set(),
    _pendingCommentPostIds: new Set(),
  };

  const TOAST_MS = 3000;

  function mapSupabaseError(err) {
    const code = err?.code || '';
    const msg = String(err?.message || err || '').toLowerCase();
    if (code === '42501' || msg.includes('permission denied') || msg.includes('policy')) {
      if (msg.includes('messages')) {
        return 'Sem permissão para enviar esta mensagem (sessão ou conversa). Tente sair e entrar de novo.';
      }
      return 'Sem permissão para esta ação (RLS). Confirme sessão e políticas no Supabase.';
    }
    if (code === 'PGRST301' || msg.includes('jwt') || msg.includes('expired')) {
      return 'Sessão expirada. Faça login novamente.';
    }
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return 'Esta ação já foi registada.';
    }
    if (
      /failed to fetch|loadfailed|networkerror|a network change was detected|net::err/i.test(msg) ||
      (String(err?.name || '') === 'TypeError' && /fetch/i.test(msg))
    ) {
      return 'Erro de rede. Verifique a ligação e tente de novo.';
    }
    if (msg.includes('bucket') || msg.includes('storage') || msg.includes('object not found')) {
      return 'Falha ao guardar a imagem (bucket «post-images» ou rede). Confirme migrações Supabase / Dashboard.';
    }
    if (msg.includes('mime') || msg.includes('mime type') || msg.includes('invalid type')) {
      return 'Tipo de ficheiro não aceite. Use JPEG, PNG, WebP ou GIF (máx. 5 MB).';
    }
    return err?.message ? String(err.message) : 'Ocorreu um erro. Tente novamente.';
  }

  function isUniqueViolation(err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '').toLowerCase();
    return code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint');
  }

  function isTransientCommentError(err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '').toLowerCase();
    return code === '40001' || code === '40P01' || /network|fetch|timeout|temporar|deadlock|serialization/i.test(msg);
  }

  /** Toast fixo canto inferior direito: type = success | error | info */
  function showToast(message, type) {
    const kind = type === 'success' || type === 'error' || type === 'info' ? type : 'info';
    const text = typeof message === 'string' ? message : String(message?.title || message?.message || message || '');
    if (!text) return;

    if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
      PopupSystem.toast({
        icon: kind === 'error' ? '⚠️' : kind === 'success' ? '✓' : '🔔',
        title: text.replace(/^[✅❌⚠️🔗✨ℹ️]\s*/, '').slice(0, 140),
        sub: text.length > 140 ? text : undefined,
        duration: TOAST_MS,
      });
      return;
    }

    let host = document.getElementById('destaq-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'destaq-toast-host';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `destaq-toast destaq-toast--${kind}`;
    el.setAttribute('role', 'status');
    el.textContent = text.replace(/^[✅❌⚠️🔗✨ℹ️]\s*/, '');
    host.appendChild(el);
    const t = setTimeout(() => {
      el.classList.add('destaq-toast--out');
      setTimeout(() => el.remove(), 220);
    }, TOAST_MS);
    el.addEventListener('click', () => {
      clearTimeout(t);
      el.remove();
    });
  }

  window.destaqNetworkToast = showToast;

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /** Apenas http(s) — evita javascript:, data:, etc. em hrefs e avatares remotos. */
  function sanitizeHttpUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const t = raw.trim();
    if (!/^https?:\/\//i.test(t)) return '';
    try {
      const u = new URL(t);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.href;
    } catch (_) {
      return '';
    }
  }

  function hashStringToUint(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function linkifyMessageToFragment(plainText) {
    const text = plainText == null ? '' : String(plainText);
    const frag = document.createDocumentFragment();
    const re = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}>'"`]*)/gi;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const safeHref = sanitizeHttpUrl(m[0]);
      if (safeHref) {
        const a = document.createElement('a');
        a.href = safeHref;
        a.textContent = m[0];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'nw-msg-link';
        frag.appendChild(a);
      } else {
        frag.appendChild(document.createTextNode(m[0]));
      }
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function fillMessageBubble(bubbleEl, content, timeStr) {
    while (bubbleEl.firstChild) bubbleEl.removeChild(bubbleEl.firstChild);
    bubbleEl.appendChild(linkifyMessageToFragment(content));
    const span = document.createElement('span');
    span.className = 'nw-msg-time';
    span.textContent = timeStr;
    bubbleEl.appendChild(span);
  }

  function renderFeedSkeletonHtml() {
    const sk = `<div class="nw-skel-card" aria-hidden="true"><div class="nw-skel-line nw-skel-line--lg"></div><div class="nw-skel-line"></div><div class="nw-skel-line"></div><div class="nw-skel-line nw-skel-line--sm"></div></div>`;
    return sk + sk + sk;
  }

  function renderFeedEmptyHtml() {
    return `<div class="nw-feed-empty" role="status">
      <svg class="nw-feed-empty-svg" viewBox="0 0 120 100" width="120" height="100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="15" width="100" height="70" rx="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.35"/>
        <circle cx="40" cy="45" r="10" fill="currentColor" opacity="0.2"/>
        <path d="M58 42h36M58 52h28M58 62h32" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.25"/>
      </svg>
      <p class="nw-feed-empty-text">Seja o primeiro a postar!</p>
    </div>`;
  }

  function paintFeedFromState() {
    const feed = document.getElementById('nw-feed');
    if (!feed) return;
    if (networkState.posts.length) {
      feed.innerHTML = networkState.posts.map(renderPost).join('');
      return;
    }
    feed.innerHTML =
      networkState.activeFilter === 'all'
        ? renderFeedEmptyHtml()
        : '<p class="nw-muted" style="padding:12px;color:#888899" role="status">Nada nesta categoria.</p>';
  }

  function paintFeedSkeleton() {
    const feed = document.getElementById('nw-feed');
    if (feed) feed.innerHTML = renderFeedSkeletonHtml();
  }

  function refreshNetworkOfflineUI() {
    networkState.isOnline = navigator.onLine;
    const banner = document.getElementById('nw-offline-banner');
    if (banner) banner.hidden = networkState.isOnline;
    const dis = !networkState.isOnline;
    const sel =
      '#nw-app .nw-chat-textarea, #nw-app #nw-chat-send, #nw-app .nw-comment-input, #nw-app .nw-send-btn, #nw-app #nw-dm-search, #nw-app .nw-filter-btn, #nw-app .nw-create-fake, #nw-app .nw-quick-btn, #nw-app #nw-publish-btn, #nw-create-post-modal textarea, #nw-create-post-modal #nw-publish-btn, #nw-create-post-modal .nw-type-sel';
    document.querySelectorAll(sel).forEach((el) => {
      if (el && 'disabled' in el) el.disabled = dis;
    });
  }

  function bindNetworkOnlineOffline() {
    if (networkState._offlineListenersBound) return;
    networkState._offlineListenersBound = true;
    window.addEventListener('online', refreshNetworkOfflineUI);
    window.addEventListener('offline', refreshNetworkOfflineUI);
    refreshNetworkOfflineUI();
  }

  function normalizePost(post) {
    const author = post.author || post.profiles || {};
    return { ...post, author };
  }

  function isDemoPost(id) {
    return String(id).startsWith('demo-');
  }

  /** Sem embed `profiles` — evita 400 no PostgREST se não houver FK nomeada; autores vêm de hydratePostsAuthors. */
  const POST_COLUMNS = '*';

  const PROFILE_FIELDS_FOR_POST =
    'id, user_id, username, display_name, avatar_url, role, company_name, verified, niche, posts_count';

  async function hydratePostsAuthors(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return list;
    const client = getClient();
    if (!client) return list;
    const ids = [...new Set(list.map((r) => r.author_id).filter(Boolean))];
    if (!ids.length) return list.map((r) => ({ ...r, profiles: null }));
    const { data: profs, error } = await client.from('profiles').select(PROFILE_FIELDS_FOR_POST).in('id', ids);
    if (error) {
      logNetworkWarn('[Network] hydratePostsAuthors:', error);
      return list.map((r) => ({ ...r, profiles: null }));
    }
    const map = new Map((profs || []).map((p) => [p.id, p]));
    return list.map((r) => ({ ...r, profiles: map.get(r.author_id) || null }));
  }

  async function initNetworkAuth() {
    const client = getClient();
    if (!client) return;

    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      networkState.currentUser = session.user;
      await loadCurrentProfile(session.user.id);
    }

    if (!networkState._authListenerBound) {
      networkState._authListenerBound = true;
      client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          networkState.currentUser = session.user;
          await loadCurrentProfile(session.user.id);
          if (nwIsNetworkTabActive() && typeof window.renderNetworkTab === 'function') await window.renderNetworkTab();
        } else if (event === 'SIGNED_OUT') {
          invalidateFeedCache();
          if (typeof window.destroyNetworkTab === 'function') window.destroyNetworkTab();
          networkState.currentUser = null;
          networkState.currentProfile = null;
          networkState.likedPostIds.clear();
          networkState.conversations = [];
          networkState.selectedConversationId = null;
          if (nwIsNetworkTabActive() && typeof window.renderNetworkTab === 'function') await window.renderNetworkTab();
        }
      });
    }

    if (!networkState._destaqListenerBound) {
      networkState._destaqListenerBound = true;
      document.addEventListener('destaq:authChange', async (ev) => {
        const u = ev.detail?.user || null;
        networkState.currentUser = u;
        if (u) await loadCurrentProfile(u.id);
        else {
          invalidateFeedCache();
          networkState.currentProfile = null;
          networkState.likedPostIds.clear();
          networkState.conversations = [];
          networkState.selectedConversationId = null;
          if (typeof window.destroyNetworkTab === 'function') window.destroyNetworkTab();
        }
        if (nwIsNetworkTabActive() && typeof window.renderNetworkTab === 'function') await window.renderNetworkTab();
      });
    }
  }

  function nwIsNetworkTabActive() {
    const pane = document.getElementById('aba-network');
    return !!(pane && pane.classList.contains('active'));
  }

  async function loadCurrentProfile(userId) {
    const client = getClient();
    if (!client || !userId) return;
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && profile) {
      networkState.currentProfile = profile;
      await hydrateLikedPosts();
    } else {
      networkState.currentProfile = null;
    }
  }

  async function hydrateLikedPosts() {
    const client = getClient();
    if (!client || !networkState.currentProfile?.id) return;
    const { data, error } = await client
      .from('post_likes')
      .select('post_id')
      .eq('user_id', networkState.currentProfile.id)
      .limit(500);

    if (error || !data) return;
    networkState.likedPostIds = new Set(data.map((r) => String(r.post_id)));
  }

  async function loadNetworkPosts(_filter = 'all', page = 0) {
    networkState.isLoading = true;
    networkState.activeFilter = 'all';
    const client = getClient();

    if (!client) {
      loadFallbackPosts();
      networkState.isLoading = false;
      networkState.hasMore = false;
      if (page === 0) paintFeedFromState();
      return networkState.posts;
    }

    if (page === 0) paintFeedSkeleton();

    const from = page * 10;
    const to = from + 9;

    const query = client
      .from('network_posts')
      .select(POST_COLUMNS)
      .order('created_at', { ascending: false })
      .range(from, to);

    let { data: posts, error } = await query;

    if (error) {
      const r2 = await client.from('network_posts').select(POST_COLUMNS).order('created_at', { ascending: false }).range(from, to);
      posts = r2.data;
      error = r2.error;
    }

    if (error) {
      if (page === 0) loadFallbackPosts();
      networkState.isLoading = false;
      networkState.hasMore = false;
      if (page === 0) paintFeedFromState();
      return networkState.posts;
    }

    const hydrated = await hydratePostsAuthors(posts || []);
    const batch = hydrated.map(normalizePost);

    if (page === 0) networkState.posts = batch;
    else networkState.posts = [...networkState.posts, ...batch];

    networkState.hasMore = (posts?.length || 0) === 10;
    networkState.isLoading = false;

    if (page === 0 && networkState.currentUser?.id) {
      feedCache = {
        userId: networkState.currentUser.id,
        filter: 'all',
        posts: networkState.posts.slice(0, 10).map((p) => ({ ...p, author: { ...(p.author || {}) } })),
        hasMore: networkState.hasMore,
      };
    }

    if (page === 0) paintFeedFromState();

    return networkState.posts;
  }

  function guessImageContentType(file, ext) {
    if (file?.type && /^image\//i.test(file.type)) return file.type;
    const e = String(ext || '').toLowerCase();
    if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
    if (e === 'png') return 'image/png';
    if (e === 'webp') return 'image/webp';
    if (e === 'gif') return 'image/gif';
    return 'image/png';
  }

  async function uploadPostImage(file) {
    const client = getClient();
    const uid = networkState.currentUser?.id;
    if (!client || !uid || !file) return null;
    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().slice(0, 8) : 'jpg';
    const safeExt = /^jpe?g|png|webp|gif$/i.test(ext) ? ext.toLowerCase() : 'jpg';
    const path = `${uid}/${Date.now()}.${safeExt}`;
    const contentType = guessImageContentType(file, safeExt);
    const { error: upErr } = await client.storage.from('post-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });
    if (upErr) throw upErr;
    const { data: pub } = client.storage.from('post-images').getPublicUrl(path);
    return pub?.publicUrl || null;
  }

  /** Insere em network_posts: author_id (perfil), content, image_url opcional. */
  async function createPost(content, imageFile = null) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponível');
    if (!networkState.currentProfile) throw new Error('Faça login para postar');

    let imageUrl = null;
    if (imageFile && imageFile.size) {
      try {
        imageUrl = await uploadPostImage(imageFile);
      } catch (upErr) {
        logNetworkWarn('[Network] Falha no upload da imagem:', upErr);
        showToast(`${mapSupabaseError(upErr)} A publicar só com texto.`, 'info');
      }
    }

    const row = {
      author_id: networkState.currentProfile.id,
      content: String(content || '').slice(0, 1000),
      post_type: 'update',
      image_url: imageUrl,
    };
    if (imageUrl) {
      row.media_urls = [imageUrl];
      row.media_type = 'image';
    }

    const { data, error } = await client.from('network_posts').insert(row).select(POST_COLUMNS).single();
    if (error) throw error;
    const [hydratedRow] = await hydratePostsAuthors(data ? [data] : []);
    const normalized = normalizePost(hydratedRow || data);
    networkState.posts.unshift(normalized);
    if (feedCache && feedCache.userId === networkState.currentUser?.id && feedCache.filter === 'all') {
      feedCache.posts = networkState.posts.slice(0, 10).map((p) => ({ ...p, author: { ...(p.author || {}) } }));
      feedCache.hasMore = networkState.hasMore;
    }
    return normalized;
  }

  async function deleteNetworkPost(postId) {
    if (isDemoPost(postId)) {
      showToast('Posts de demonstração não podem ser apagados.', 'info');
      return;
    }
    const client = getClient();
    if (!client) {
      showToast('Supabase indisponível.', 'error');
      return;
    }
    const { error } = await client.from('network_posts').delete().eq('id', postId);
    if (error) throw error;
    networkState.posts = networkState.posts.filter((p) => String(p.id) !== String(postId));
    networkState.likedPostIds.delete(String(postId));
    document.querySelector(`.nw-post-card[data-post-id="${postId}"]`)?.remove();
    if (feedCache && feedCache.userId === networkState.currentUser?.id && feedCache.filter === 'all') {
      feedCache.posts = networkState.posts.slice(0, 10).map((p) => ({ ...p, author: { ...(p.author || {}) } }));
    }
  }

  async function toggleLike(postId) {
    if (!networkState.currentProfile) {
      if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
      else if (typeof window.showAuthModal === 'function') window.showAuthModal('login');
      return;
    }
    if (isDemoPost(postId)) {
      showToast('Posts de demonstração.', 'info');
      return;
    }
    const client = getClient();
    if (!client) return;
    const profileId = networkState.currentProfile.id;
    const likeKey = String(postId);
    if (networkState._pendingLikePostIds.has(likeKey)) return networkState.likedPostIds.has(likeKey);
    networkState._pendingLikePostIds.add(likeKey);
    try {
      const alreadyLiked = networkState.likedPostIds.has(likeKey);
      if (alreadyLiked) {
        const { error } = await client.from('post_likes').delete().eq('post_id', postId).eq('user_id', profileId);
        if (error) throw error;
        networkState.likedPostIds.delete(likeKey);
        return false;
      }

      const { error } = await client.from('post_likes').insert({ post_id: postId, user_id: profileId });
      if (error && !isUniqueViolation(error)) throw error;
      networkState.likedPostIds.add(likeKey);
      return true;
    } finally {
      networkState._pendingLikePostIds.delete(likeKey);
    }
  }

  async function addComment(postId, content) {
    if (!networkState.currentProfile) {
      if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
      else if (typeof window.showAuthModal === 'function') window.showAuthModal('login');
      return null;
    }
    if (isDemoPost(postId)) {
      showToast('Comentários requerem posts reais.', 'info');
      return null;
    }
    const client = getClient();
    const { data, error } = await client
      .from('post_comments')
      .insert({
        post_id: postId,
        author_id: networkState.currentProfile.id,
        content,
      })
      .select('*, profiles(username, display_name, avatar_url, role)')
      .single();

    if (error) throw error;
    return { ...data, author: data.profiles || {} };
  }

  function teardownNetworkRealtime() {
    const client = getClient();
    if (networkState._realtimeChannel && client) {
      try {
        client.removeChannel(networkState._realtimeChannel);
      } catch (_) { /* ignore */ }
    }
    networkState._realtimeChannel = null;
  }

  function updateLikeCountInDom(postId, delta) {
    const card = document.querySelector(`.nw-post-card[data-post-id="${postId}"]`);
    const cnt = card?.querySelector('.like-count');
    if (!cnt) return;
    const n = Math.max(0, (parseInt(cnt.textContent, 10) || 0) + delta);
    cnt.textContent = String(n);
  }

  function patchProfileInLocalFeedState() {
    const profile = networkState.currentProfile;
    if (!profile?.id) return;
    networkState.posts = networkState.posts.map((p) => {
      const author = p.author || p.profiles || {};
      if (author.id !== profile.id && p.author_id !== profile.id) return p;
      return { ...p, author: { ...author, ...profile } };
    });

    if (feedCache && feedCache.userId === networkState.currentUser?.id && feedCache.filter === 'all') {
      feedCache.posts = networkState.posts.slice(0, 10).map((p) => ({ ...p, author: { ...(p.author || {}) } }));
    }
  }

  function refreshProfileUiIncremental() {
    const app = document.getElementById('nw-app');
    if (!app) return;
    const sidebar = app.querySelector('.nw-sidebar');
    if (sidebar) sidebar.innerHTML = renderSidebar();
    const createPost = app.querySelector('.nw-feed-scroll .nw-create-post');
    if (createPost) createPost.outerHTML = renderCreatePostBox();
    patchProfileInLocalFeedState();
    paintFeedFromState();
    setupFeedInfiniteScroll();
  }

  async function prependPostFromServer(postId) {
    const client = getClient();
    const feed = document.getElementById('nw-feed');
    if (!client || !feed || !postId) return;
    if (document.querySelector(`.nw-post-card[data-post-id="${postId}"]`)) return;
    const { data, error } = await client.from('network_posts').select(POST_COLUMNS).eq('id', postId).maybeSingle();
    if (error || !data) return;
    const [hydrated] = await hydratePostsAuthors([data]);
    const post = normalizePost(hydrated || data);
    if (networkState.posts.every((p) => String(p.id) !== String(post.id))) {
      networkState.posts.unshift(post);
    }
    if (feedCache && feedCache.userId === networkState.currentUser?.id && feedCache.filter === 'all') {
      feedCache.posts = networkState.posts.slice(0, 10).map((p) => ({ ...p, author: { ...(p.author || {}) } }));
    }
    feed.insertAdjacentHTML('afterbegin', renderPost(post));
    setupFeedInfiniteScroll();
  }

  function subscribeToNetworkUpdates() {
    const client = getClient();
    if (!client || !networkState.currentUser) return;

    teardownNetworkRealtime();

    const myProfileId = networkState.currentProfile?.id;

    networkState._realtimeChannel = client
      .channel(`network-feed-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'network_posts' },
        (payload) => {
          const mine = myProfileId && payload.new?.author_id === myProfileId;
          if (mine) return;
          showToast('Nova publicação no feed.', 'info');
          prependPostFromServer(payload.new?.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_likes' },
        (payload) => {
          const uid = payload.new?.user_id;
          if (uid && uid === myProfileId) return;
          if (payload.new?.post_id) updateLikeCountInDom(payload.new.post_id, 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'post_likes' },
        (payload) => {
          const uid = payload.old?.user_id;
          if (uid && uid === myProfileId) return;
          if (payload.old?.post_id) updateLikeCountInDom(payload.old.post_id, -1);
        }
      )
      .subscribe();
  }

  function unsubscribeChatForConversation(convId) {
    if (!convId) return;
    const client = getClient();
    const bundle = networkState.realtimeChannels[convId];
    if (!bundle) return;
    if (bundle.messages && client) {
      try {
        client.removeChannel(bundle.messages);
      } catch (_) { /* ignore */ }
    }
    if (bundle.presence && client) {
      try {
        client.removeChannel(bundle.presence);
      } catch (_) { /* ignore */ }
    }
    delete networkState.realtimeChannels[convId];
    if (networkState._subscribedChatConvId === convId) networkState._subscribedChatConvId = null;
  }

  function teardownMsgRealtime() {
    const cid = networkState._subscribedChatConvId || networkState.selectedConversationId;
    if (cid) unsubscribeChatForConversation(cid);
  }

  function unsubscribeDmListChannel() {
    const client = getClient();
    if (networkState._dmListChannel && client) {
      try {
        client.removeChannel(networkState._dmListChannel);
      } catch (_) { /* ignore */ }
    }
    networkState._dmListChannel = null;
  }

  /** Cleanup de todos os canais DM + listeners do input do chat (ao sair da aba Network). */
  window.destroyNetworkTab = function () {
    const client = getClient();
    Object.keys(networkState.realtimeChannels).forEach((cid) => unsubscribeChatForConversation(cid));
    networkState.realtimeChannels = {};
    unsubscribeDmListChannel();
    teardownNetworkRealtime();
    networkState._subscribedChatConvId = null;
    networkState.conversationIdSet = new Set();
    if (networkState._chatInputAbort) {
      try {
        networkState._chatInputAbort.abort();
      } catch (_) { /* ignore */ }
      networkState._chatInputAbort = null;
    }
    clearTimeout(networkState._typingTrackTimer);
    clearTimeout(networkState._typingDebounceTimer);
    clearTimeout(networkState._typingClearTimer);
    networkState._typingTrackTimer = null;
    networkState._typingDebounceTimer = null;
    networkState._typingClearTimer = null;
    document.getElementById('nw-chat-peer-profile-modal')?.remove();
  };

  function loadFallbackPosts() {
    networkState.posts = [
      {
        id: 'demo-1',
        content: '🎯 Case de sucesso: aumentamos o ROAS de um e-commerce de moda em 312% em 90 dias. #marketing #ecommerce',
        post_type: 'article',
        likes_count: 156,
        comments_count: 67,
        shares_count: 23,
        tags: ['marketing', 'roas'],
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        author: { id: 'demo-a1', username: 'agencia_mkt', display_name: 'ConversionLab', role: 'agency', company_name: 'ConversionLab', verified: true, avatar_url: null },
      },
      {
        id: 'demo-2',
        content: '📊 Análise: skincare em alta no Q1. #beleza #ecommerce',
        post_type: 'update',
        likes_count: 93,
        comments_count: 28,
        shares_count: 15,
        tags: ['beleza'],
        created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        author: { id: 'demo-a2', username: 'beleza_skin', display_name: 'Skin & Beauty Hub', role: 'brand', company_name: 'Skin Beauty', verified: true, avatar_url: null },
      },
    ];
    return networkState.posts;
  }

  function getAvatarFallback(name) {
    const parts = String(name || 'DestaQ').trim().split(/\s+/).filter(Boolean);
    const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || 'D').slice(0, 2)).toUpperCase();
    const h = hashStringToUint(String(name || 'DestaQ'));
    const hue = h % 360;
    const sat = 55 + (h % 18);
    const light = 42 + (h % 12);
    const color = `hsl(${hue}, ${sat}%, ${light}%)`;
    return `<div class="nw-avatar-fallback" style="background:${color}">${escapeHtml(initials)}</div>`;
  }

  function renderAvatar(author) {
    const url = author?.avatar_url ? sanitizeHttpUrl(author.avatar_url) : '';
    if (url) {
      return `<img src="${escapeHtml(url)}" alt="" loading="lazy">`;
    }
    return getAvatarFallback(author?.display_name || author?.username);
  }

  const ROLE_CONFIG = {
    seller: { label: 'Seller', color: '#8B5CF6' },
    brand: { label: 'Marca', color: '#EC4899' },
    agency: { label: 'Agência', color: '#0066FF' },
    influencer: { label: 'Influencer', color: '#F59E0B' },
    admin: { label: 'Admin', color: '#10B981' },
  };

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const min = Math.floor(diffMs / 60000);
    const h = Math.floor(min / 60);
    const days = Math.floor(h / 24);
    if (min < 1) return 'agora';
    if (h < 1) return `há ${min}m`;
    if (days < 1) return `há ${h}h`;
    return `há ${days}d`;
  }

  function formatRelativeTimePt(dateStr) {
    return timeAgo(dateStr);
  }

  function formatMsgTime(iso) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function dayLabelForMessage(iso) {
    const t = new Date(iso);
    const today = new Date();
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (t.toDateString() === today.toDateString()) return 'Hoje';
    if (t.toDateString() === yest.toDateString()) return 'Ontem';
    return t.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  }

  function renderPost(post) {
    const author = post.author || {};
    const authorName = escapeHtml(author.display_name || author.full_name || 'Usuário');
    const isLiked = networkState.likedPostIds.has(String(post.id));
    const safeContent = escapeHtml(post.content || '');
    const isAuthor = !!(networkState.currentProfile && author.id && networkState.currentProfile.id === author.id);
    const rawImg = post.image_url || (Array.isArray(post.media_urls) && post.media_urls[0]) || '';
    const imgUrl = rawImg ? sanitizeHttpUrl(rawImg) : '';
    const imgBlock = imgUrl
      ? `<div class="nw-post-media"><img src="${escapeHtml(imgUrl)}" alt="" loading="lazy"></div>`
      : '';

    return `
    <article class="nw-post-card" data-post-id="${post.id}" data-author-id="${escapeHtml(String(author.id || post.author_id || ''))}">
      <div class="nw-post-head">
        <div class="nw-post-author">
          <div class="nw-avatar">${renderAvatar(author)}</div>
          <div class="nw-post-names">
            <strong>${authorName}</strong>
          </div>
        </div>
        <div class="nw-post-head-right">
          <span class="nw-post-time">${timeAgo(post.created_at)}</span>
          ${isAuthor ? `<button type="button" class="nw-action nw-dd-danger" aria-label="Excluir publicação" onclick="networkConfirmDeletePost('${post.id}')">Excluir</button>` : ''}
        </div>
      </div>
      <div class="nw-post-body" data-post-body="${post.id}">
        <p class="nw-post-text">${safeContent}</p>
      </div>
      ${imgBlock}
      <div class="nw-post-actions">
        <button type="button" class="nw-action nw-like ${isLiked ? 'nw-liked' : ''}" aria-label="${isLiked ? 'Retirar gosto' : 'Gostar'} da publicação" onclick="networkHandleLikePost('${post.id}', this)">
          <span aria-hidden="true">${isLiked ? '❤️' : '🤍'}</span> Curtir <span class="like-count">${post.likes_count ?? 0}</span>
        </button>
        <button type="button" class="nw-action" aria-label="Comentar publicação" onclick="networkToggleComments('${post.id}', this)">
          <span aria-hidden="true">💬</span> Comentar <span data-comments-for="${post.id}">${post.comments_count ?? 0}</span>
        </button>
      </div>
      <div class="nw-comments" id="comments-${post.id}">
        <div class="nw-comment-input-row">
          <div class="nw-avatar" style="width:32px;height:32px">${networkState.currentProfile ? renderAvatar(networkState.currentProfile) : getAvatarFallback('?')}</div>
          <input type="text" class="nw-comment-input" placeholder="Comentário..." aria-label="Escrever comentário" onkeydown="networkCommentKey(event, '${post.id}', this)">
          <button type="button" class="nw-send-btn" style="width:40px;height:40px" aria-label="Enviar comentário" onclick="networkSubmitComment('${post.id}', this.previousElementSibling)"><span aria-hidden="true">↑</span></button>
        </div>
        <div id="comments-list-${post.id}"><div style="color:#888899;font-size:0.8rem">Carregar comentários…</div></div>
      </div>
    </article>`;
  }

  window.networkConfirmDeletePost = async function (postId) {
    if (!confirm('Eliminar esta publicação? Os comentários e curtidas serão removidos.')) return;
    try {
      await deleteNetworkPost(postId);
      showToast('Publicação eliminada.', 'success');
    } catch (err) {
      showToast(mapSupabaseError(err), 'error');
    }
  };

  function updateComposePublishBtn() {
    const ta = document.getElementById('nw-new-post-text');
    const pub = document.getElementById('nw-publish-btn');
    const counter = document.getElementById('nw-post-char-count');
    const len = (ta?.value || '').length;
    if (counter) counter.textContent = String(len);
    if (pub) pub.disabled = len === 0 || len > 1000;
  }

  function onComposeImageChange() {
    const fileIn = document.getElementById('nw-post-image-input');
    const prev = document.getElementById('nw-post-image-preview');
    if (!prev || !fileIn?.files?.[0]) {
      if (prev) {
        prev.innerHTML = '';
        prev.hidden = true;
      }
      return;
    }
    const f = fileIn.files[0];
    if (f.size > 5 * 1024 * 1024) {
      showToast('Imagem demasiado grande (máx. 5 MB).', 'error');
      fileIn.value = '';
      prev.innerHTML = '';
      prev.hidden = true;
      return;
    }
    const url = URL.createObjectURL(f);
    prev.innerHTML = `<img src="${url}" alt="">`;
    prev.hidden = false;
  }

  function wireComposeModal() {
    const modal = document.getElementById('nw-create-post-modal');
    if (!modal) return;
    if (!modal.dataset.composeWired) {
      modal.dataset.composeWired = '1';
      document.getElementById('nw-new-post-text')?.addEventListener('input', updateComposePublishBtn);
      document.getElementById('nw-post-image-input')?.addEventListener('change', onComposeImageChange);
    }
    updateComposePublishBtn();
  }

  function renderCreatePostBox() {
    const p = networkState.currentProfile;
    return `
    <div class="nw-create-post">
      <div class="nw-create-row">
        <div class="nw-avatar" style="width:40px;height:40px">${p ? renderAvatar(p) : getAvatarFallback('?')}</div>
        <button type="button" class="nw-create-fake" aria-label="Criar nova publicação" onclick="networkOpenCreatePostModal()">
          ${p ? `Partilhe uma ideia, ${escapeHtml(p.display_name?.split(' ')[0] || '')}…` : 'Faça login para publicar…'}
        </button>
      </div>
    </div>`;
  }

  function renderFeed() {
    return `
      <div class="nw-feed-header">
        <h2 class="nw-feed-title">Feed</h2>
      </div>
      <div class="nw-feed-scroll" id="nw-feed-scroll">
        ${renderCreatePostBox()}
        <div id="nw-feed"></div>
        <div class="nw-feed-sentinel" id="nw-feed-sentinel" aria-hidden="true"></div>
      </div>`;
  }

  function renderRightPanel() {
    return `
      <div class="nw-right-block">
        <h4>Atalhos</h4>
        <p style="color:#888899;font-size:0.82rem;line-height:1.5;margin:0">
          Use o feed para trocar ideias e abra mensagens diretas para conversar em tempo real.
        </p>
      </div>`;
  }

  function renderSidebar() {
    const p = networkState.currentProfile;
    const joinedAt = p?.created_at
      ? new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;
    const bio = p?.bio || p?.company_name || 'Sem bio ainda.';
    const profileBlock = p
      ? `<div class="nw-profile-card ${networkState.profileCollapsed ? 'is-collapsed' : ''}" id="nw-profile-card">
          <button
            type="button"
            class="nw-profile-toggle"
            aria-label="${networkState.profileCollapsed ? 'Expandir painel do perfil' : 'Recolher painel do perfil'}"
            aria-expanded="${networkState.profileCollapsed ? 'false' : 'true'}"
            onclick="networkToggleProfileCard()"
          >
            <div class="nw-avatar" style="width:40px;height:40px">${renderAvatar(p)}</div>
            <div class="nw-profile-toggle-text">
              <strong>${escapeHtml(p.display_name || '')}</strong>
            </div>
            <span class="nw-profile-toggle-icon" aria-hidden="true">${networkState.profileCollapsed ? '▾' : '▴'}</span>
          </button>
          <div class="nw-profile-details">
            <div class="nw-avatar" style="width:72px;height:72px">${renderAvatar(p)}</div>
            <div class="nw-profile-meta">
              <div class="nw-profile-name-row">
                <button
                  type="button"
                  class="nw-profile-name-btn"
                  onclick="networkToggleProfileMenu()"
                  aria-label="Abrir opções do perfil"
                  aria-expanded="${networkState.profileMenuOpen ? 'true' : 'false'}"
                >
                  ${escapeHtml(p.display_name || '')}
                </button>
                <div class="nw-profile-menu ${networkState.profileMenuOpen ? 'is-open' : ''}" id="nw-profile-menu">
                  <button type="button" class="nw-profile-menu-item" onclick="networkOpenProfileEditorFromMenu()">Editar perfil</button>
                  <button type="button" class="nw-profile-menu-item" onclick="window.authSignOut && window.authSignOut()">Sair</button>
                </div>
              </div>
              <small>${escapeHtml(String(bio))}</small>
              ${joinedAt ? `<small>Entrou em ${escapeHtml(joinedAt)}</small>` : ''}
            </div>
          </div>
        </div>`
      : `<div class="nw-profile-card"><small style="color:#888899">Sem perfil carregado</small></div>`;

    return `
      <div class="nw-sidebar-inner">
        ${profileBlock}
        <div class="nw-search-wrap">
          <input type="search" class="nw-search" id="nw-dm-search" placeholder="Buscar conversas…" autocomplete="off" aria-label="Buscar conversas">
        </div>
        <div class="nw-section-label">Mensagens</div>
        <div class="nw-conv-list" id="nw-conv-list"><p style="padding:12px;color:#888899;font-size:0.8rem">A carregar…</p></div>
      </div>`;
  }

  /** Vista chat DM (conteúdo preenchido em networkSelectConversation / loadAndRenderMessages). */
  function renderChat(_conversationId) {
    return `
      <div class="nw-chat-header">
        <button type="button" class="nw-chat-back" onclick="networkCloseChatMobile()" aria-label="Voltar">←</button>
        <button type="button" class="nw-chat-peer-hit" id="nw-chat-peer-btn" onclick="networkOpenChatPeerProfile()" aria-label="Ver perfil do contacto">
          <div class="nw-avatar" id="nw-chat-header-avatar" style="width:40px;height:40px" aria-hidden="true"></div>
          <div class="nw-chat-peer">
            <strong id="nw-chat-header-name">Chat</strong>
            <span class="nw-chat-status" id="nw-chat-header-status">No Network</span>
          </div>
        </button>
      </div>
      <div class="nw-chat-scroll" id="nw-chat-scroll">
        <div id="nw-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Mensagens da conversa"></div>
      </div>
      <div class="nw-chat-footer">
        <label class="nw-sr-only" for="nw-chat-input">Mensagem</label>
        <textarea class="nw-chat-textarea" id="nw-chat-input" rows="1" placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter nova linha)" autocomplete="off"></textarea>
        <button type="button" class="nw-send-btn" id="nw-chat-send" onclick="networkSendDm()" aria-label="Enviar mensagem">➤</button>
      </div>`;
  }

  function renderGuestCTA() {
    return `
      <div class="nw-guest" style="min-height:55vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;background:#0a0a0f;color:#e8e8f0;font-family:system-ui,sans-serif">
        <p style="max-width:360px;margin:0 0 1.25rem;color:#c4c4d4">Faça login para acessar o Network — feed, mensagens e conexões.</p>
        <div class="nw-guest-actions" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">
          <button type="button" class="nw-guest-btn" aria-label="Entrar na conta DestaQ" onclick="(typeof window.openAuthModal==='function'?window.openAuthModal('login'):typeof window.showAuthModal==='function'&&window.showAuthModal('login'))">Entrar</button>
          <button type="button" class="nw-guest-btn nw-guest-btn--outline" aria-label="Criar conta DestaQ" onclick="(typeof window.openAuthModal==='function'?window.openAuthModal('signup'):typeof window.showAuthModal==='function'&&window.showAuthModal('signup'))">Criar conta</button>
        </div>
      </div>`;
  }

  function renderCreatePostModalHtml() {
    const p = networkState.currentProfile;
    return `
    <div class="nw-modal-overlay" id="nw-create-post-modal" onclick="networkCloseCreatePostModal(event)">
      <div class="nw-modal nw-modal--compose" onclick="event.stopPropagation()">
        <h3>Criar publicação</h3>
        <div class="nw-modal-author">
          <div class="nw-avatar" style="width:40px;height:40px">${renderAvatar(p)}</div>
          <strong>${escapeHtml(p?.display_name || '')}</strong>
        </div>
        <label class="nw-label" for="nw-new-post-text">Texto</label>
        <textarea id="nw-new-post-text" maxlength="1000" placeholder="O que você quer compartilhar?" rows="6"></textarea>
        <div class="nw-char-row"><span id="nw-post-char-count">0</span>/1000</div>
        <label class="nw-label" for="nw-post-image-input">Anexar imagem</label>
        <input type="file" id="nw-post-image-input" accept="image/jpeg,image/png,image/webp,image/gif" class="nw-file-input">
        <div id="nw-post-image-preview" class="nw-image-preview" hidden></div>
        <button type="button" id="nw-publish-btn" class="nw-publish" disabled onclick="networkSubmitNewPost()">Postar</button>
        <button type="button" class="nw-btn-edit nw-modal-cancel" onclick="networkCloseCreatePostModal()">Cancelar</button>
      </div>
    </div>`;
  }

  function isLikelyMissingDmTables(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    const code = String(err?.code || '');
    const st = err?.status ?? err?.statusCode;
    return (
      st === 404 ||
      code === '42P01' ||
      code === 'PGRST205' ||
      msg.includes('schema cache') ||
      msg.includes('does not exist') ||
      msg.includes('not found')
    );
  }

  async function findOrCreateConversationWithPeer(peerAuthUserId) {
    const client = getClient();
    const me = networkState.currentUser?.id;
    if (!client || !me || !peerAuthUserId || peerAuthUserId === me) return null;

    const { data: myRows, error: eMy } = await client.from('conversation_participants').select('conversation_id').eq('user_id', me);
    if (eMy) {
      logNetworkErr('[Network] DM conversation_participants:', eMy);
      if (!networkState._dmTablesMissingWarned && isLikelyMissingDmTables(eMy)) {
        networkState._dmTablesMissingWarned = true;
        showToast('Mensagens DM indisponíveis: aplique no Supabase a migração «destaq_network_dm_v1».', 'error');
      } else {
        showToast(mapSupabaseError(eMy), 'error');
      }
      return null;
    }
    const convIds = (myRows || []).map((r) => r.conversation_id);
    if (!convIds.length) return createConversationPair(client, me, peerAuthUserId);

    const { data: allP, error: eAll } = await client
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds);
    if (eAll) {
      logNetworkErr('[Network] DM participants list:', eAll);
      showToast(mapSupabaseError(eAll), 'error');
      return null;
    }

    const byConv = {};
    for (const row of allP || []) {
      if (!byConv[row.conversation_id]) byConv[row.conversation_id] = [];
      byConv[row.conversation_id].push(row.user_id);
    }
    for (const cid of convIds) {
      const uids = byConv[cid] || [];
      if (uids.length === 2 && uids.includes(me) && uids.includes(peerAuthUserId)) return cid;
    }
    return createConversationPair(client, me, peerAuthUserId);
  }

  async function createConversationPair(client, me, peer) {
    const { data: conv, error } = await client.from('conversations').insert({}).select('id').single();
    if (error) throw error;
    const id = conv.id;
    const { error: e1 } = await client.from('conversation_participants').insert({ conversation_id: id, user_id: me });
    if (e1) throw e1;
    const { error: e2 } = await client.from('conversation_participants').insert({ conversation_id: id, user_id: peer });
    if (e2) throw e2;
    return id;
  }

  async function loadConversationsEnriched() {
    const client = getClient();
    const me = networkState.currentUser?.id;
    if (!client || !me) {
      networkState.conversations = [];
      return;
    }

    const { data: myParts, error: errParts } = await client
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', me);

    if (errParts) {
      logNetworkWarn('[Network] loadConversationsEnriched:', errParts);
      networkState.conversations = [];
      networkState.conversationIdSet = new Set();
      if (!networkState._dmTablesMissingWarned && isLikelyMissingDmTables(errParts)) {
        networkState._dmTablesMissingWarned = true;
        showToast('Mensagens DM indisponíveis: aplique no Supabase a migração «destaq_network_dm_v1».', 'error');
      }
      return;
    }

    const convIdsRaw = (myParts || []).map((r) => r.conversation_id);
    if (!convIdsRaw.length) {
      networkState.conversations = [];
      networkState.conversationIdSet = new Set();
      return;
    }

    const lastReadMap = {};
    (myParts || []).forEach((r) => { lastReadMap[r.conversation_id] = r.last_read_at; });

    const { data: convRows } = await client.from('conversations').select('id, updated_at').in('id', convIdsRaw);
    const updatedMap = {};
    (convRows || []).forEach((c) => { updatedMap[c.id] = c.updated_at; });

    const convIds = [...convIdsRaw].sort(
      (a, b) => new Date(updatedMap[b] || 0) - new Date(updatedMap[a] || 0)
    );

    const { data: allParts } = await client
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds);

    const peerByConv = {};
    for (const row of allParts || []) {
      if (row.user_id === me) continue;
      peerByConv[row.conversation_id] = row.user_id;
    }

    const peerIds = [...new Set(Object.values(peerByConv))];
    let profilesByUser = {};
    if (peerIds.length) {
      const { data: profs } = await client
        .from('profiles')
        .select('user_id, display_name, avatar_url, id, niche, company_name')
        .in('user_id', peerIds);
      (profs || []).forEach((pr) => { profilesByUser[pr.user_id] = pr; });
    }

    const { data: recentMsgs } = await client
      .from('messages')
      .select('id, conversation_id, content, created_at, sender_id, is_deleted')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(200);

    const lastMsgByConv = {};
    for (const m of recentMsgs || []) {
      if (m.is_deleted === true) continue;
      if (!lastMsgByConv[m.conversation_id]) lastMsgByConv[m.conversation_id] = m;
    }

    const unreadCounts = {};
    await Promise.all(
      convIds.map(async (cid) => {
        const lr = lastReadMap[cid];
        const { count, error } = await client
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', cid)
          .neq('sender_id', me)
          .is('is_deleted', false)
          .gt('created_at', lr);
        unreadCounts[cid] = !error && typeof count === 'number' ? count : 0;
      })
    );

    networkState.conversations = convIds.map((cid) => {
      const peerUid = peerByConv[cid];
      const pr = peerUid ? profilesByUser[peerUid] : null;
      const lm = lastMsgByConv[cid];
      const unreadCount = unreadCounts[cid] || 0;
      return {
        id: cid,
        peerUserId: peerUid,
        peerProfileId: pr?.id || null,
        peerName: pr?.display_name || 'Utilizador',
        peerAvatar: pr?.avatar_url,
        lastPreview: lm?.content?.slice(0, 80) || 'Sem mensagens',
        lastAt: lm?.created_at || updatedMap[cid],
        unreadCount,
      };
    });
    networkState.conversationIdSet = new Set(convIds);
  }

  function renderConversationList(filterText) {
    const el = document.getElementById('nw-conv-list');
    if (!el) return;
    const q = (filterText || '').toLowerCase().trim();
    const list = !q ? networkState.conversations : networkState.conversations.filter((c) => c.peerName.toLowerCase().includes(q));
    if (!list.length) {
      el.innerHTML = '<p style="padding:12px;color:#888899;font-size:0.8rem">Nenhuma conversa. Inicie um chat pelo botão Mensagem em um post.</p>';
      return;
    }
    el.innerHTML = list.map((c) => `
        <div class="nw-conv-item ${networkState.selectedConversationId === c.id ? 'is-active' : ''}" data-conv-id="${c.id}" onclick="networkSelectConversation('${c.id}')">
        <div class="nw-avatar" style="width:44px;height:44px">${c.peerAvatar && sanitizeHttpUrl(c.peerAvatar) ? `<img src="${escapeHtml(sanitizeHttpUrl(c.peerAvatar))}" alt="">` : getAvatarFallback(c.peerName)}</div>
        <div class="nw-conv-body">
          <div class="nw-conv-top">
            <span class="nw-conv-name">${escapeHtml(c.peerName)}</span>
            <span class="nw-conv-time">${formatRelativeTimePt(c.lastAt)}</span>
          </div>
          <div class="nw-conv-preview">${escapeHtml(c.lastPreview)}</div>
        </div>
        ${(c.unreadCount || 0) > 0 ? `<span class="nw-badge" aria-label="${c.unreadCount} não lidas">${c.unreadCount > 99 ? '99+' : c.unreadCount}</span>` : ''}
      </div>`).join('');
  }

  function renderEditProfileModalHtml() {
    const p = networkState.currentProfile || {};
    const safeAv = p.avatar_url ? sanitizeHttpUrl(p.avatar_url) : '';
    const initialAvatar = safeAv
      ? `<img src="${escapeHtml(safeAv)}" alt="" id="nw-profile-avatar-img" style="width:96px;height:96px;border-radius:50%;object-fit:cover;display:block">`
      : `<div id="nw-profile-avatar-img" style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#EC4899);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:2rem">${escapeHtml(((p.display_name || '?').charAt(0)).toUpperCase())}</div>`;
    return `
      <div class="nw-modal-overlay" id="nw-edit-profile-modal" style="display:flex" onclick="networkCloseEditProfileModal(event)">
        <div class="nw-modal nw-modal--compose nw-edit-profile-card" onclick="event.stopPropagation()">
          <h3>Editar perfil</h3>

          <div class="nw-edit-avatar">
            <div class="nw-edit-avatar-wrap" id="nw-profile-avatar-wrap">
              ${initialAvatar}
            </div>
            <div class="nw-edit-avatar-actions">
              <label for="nw-profile-avatar" class="nw-edit-avatar-btn">Trocar foto</label>
              <button type="button" class="nw-edit-avatar-remove" id="nw-profile-avatar-remove" ${safeAv ? '' : 'hidden'}>Remover foto</button>
              <input type="file" id="nw-profile-avatar" accept="image/jpeg,image/png,image/webp,image/gif" class="nw-sr-only">
            </div>
          </div>

          <label class="nw-label" for="nw-profile-name">Nome</label>
          <input id="nw-profile-name" class="nw-edit-input" maxlength="80" value="${escapeHtml(p.display_name || '')}" placeholder="Seu nome" />

          <label class="nw-label" for="nw-profile-bio">Bio</label>
          <textarea id="nw-profile-bio" maxlength="220" rows="3" placeholder="Fale um pouco sobre você">${escapeHtml(p.bio || '')}</textarea>

          <div class="nw-edit-actions">
            <button type="button" class="nw-edit-btn-ghost" onclick="networkCloseEditProfileModal()">Cancelar</button>
            <button type="button" id="nw-profile-save" class="nw-edit-btn-primary" onclick="networkSaveProfile()">Salvar</button>
          </div>
        </div>
      </div>`;
  }

  async function uploadProfileAvatar(file) {
    const client = getClient();
    const uid = networkState.currentUser?.id;
    if (!client || !uid || !file) return null;
    const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().slice(0, 8) : 'jpg';
    const safeExt = /^jpe?g|png|webp|gif$/i.test(ext) ? ext.toLowerCase() : 'jpg';
    const path = `${uid}/avatar-${Date.now()}.${safeExt}`;
    const contentType = guessImageContentType(file, safeExt);
    const { error: upErr } = await client.storage.from('post-images').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });
    if (upErr) throw upErr;
    const { data: pub } = client.storage.from('post-images').getPublicUrl(path);
    return pub?.publicUrl || null;
  }

  window.networkOpenEditProfileModal = function () {
    if (!networkState.currentProfile) return;
    document.getElementById('nw-edit-profile-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', renderEditProfileModalHtml());

    const fileEl = document.getElementById('nw-profile-avatar');
    const wrap = document.getElementById('nw-profile-avatar-wrap');
    const removeBtn = document.getElementById('nw-profile-avatar-remove');
    let removeFlag = false;

    function updatePreview(src, initial) {
      if (!wrap) return;
      if (src) {
        wrap.innerHTML = `<img src="${src}" alt="" id="nw-profile-avatar-img" style="width:96px;height:96px;border-radius:50%;object-fit:cover;display:block">`;
        if (removeBtn) removeBtn.hidden = false;
      } else {
        wrap.innerHTML = `<div id="nw-profile-avatar-img" style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#EC4899);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:2rem">${escapeHtml(initial || '?')}</div>`;
        if (removeBtn) removeBtn.hidden = true;
      }
    }

    fileEl?.addEventListener('change', () => {
      const f = fileEl.files?.[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) {
        showToast('Imagem demasiado grande (máx. 5 MB).', 'error');
        fileEl.value = '';
        return;
      }
      removeFlag = false;
      const url = URL.createObjectURL(f);
      updatePreview(url);
    });

    removeBtn?.addEventListener('click', () => {
      if (fileEl) fileEl.value = '';
      removeFlag = true;
      const initial = (networkState.currentProfile?.display_name || '?').charAt(0).toUpperCase();
      updatePreview('', initial);
    });

    networkState._editRemoveAvatarFlag = () => removeFlag;
  };

  window.networkCloseEditProfileModal = function (event) {
    if (event && event.target && event.target.id && event.target.id !== 'nw-edit-profile-modal') return;
    document.getElementById('nw-edit-profile-modal')?.remove();
  };

  window.networkSaveProfile = async function () {
    const client = getClient();
    if (!client || !networkState.currentProfile) return;
    const nameEl = document.getElementById('nw-profile-name');
    const bioEl = document.getElementById('nw-profile-bio');
    const avatarEl = document.getElementById('nw-profile-avatar');
    const saveBtn = document.getElementById('nw-profile-save');
    const newName = (nameEl?.value || '').trim();
    const newBio = (bioEl?.value || '').trim();
    const avatarFile = avatarEl?.files?.[0] || null;
    const shouldRemove = typeof networkState._editRemoveAvatarFlag === 'function' && networkState._editRemoveAvatarFlag();
    if (!newName) {
      showToast('Informe um nome para salvar o perfil.', 'info');
      return;
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando…';
    }
    try {
      let avatarUrl = networkState.currentProfile.avatar_url || null;
      if (avatarFile) avatarUrl = await uploadProfileAvatar(avatarFile);
      else if (shouldRemove) avatarUrl = null;
      const row = {
        display_name: newName,
        bio: newBio,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from('profiles')
        .update(row)
        .eq('id', networkState.currentProfile.id)
        .select('*')
        .single();
      if (error) throw error;
      networkState.currentProfile = data || { ...networkState.currentProfile, ...row };

      try {
        const uid = networkState.currentUser?.id;
        if (uid && typeof client.auth.updateUser === 'function') {
          await client.auth.updateUser({
            data: { full_name: newName, display_name: newName, avatar_url: avatarUrl },
          });
        }
      } catch (_) { /* não bloquear UX */ }

      document.dispatchEvent(
        new CustomEvent('destaq:profileUpdated', { detail: { profile: networkState.currentProfile } })
      );

      patchProfileInLocalFeedState();
      showToast('Perfil atualizado com sucesso.', 'success');
      networkCloseEditProfileModal();
      refreshProfileUiIncremental();
    } catch (e) {
      showToast(mapSupabaseError(e), 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar';
      }
    }
  };

  window.networkToggleProfileCard = function () {
    networkState.profileCollapsed = !networkState.profileCollapsed;
    const card = document.getElementById('nw-profile-card');
    if (!card) return;
    card.classList.toggle('is-collapsed', networkState.profileCollapsed);
    const toggleBtn = card.querySelector('.nw-profile-toggle');
    const icon = card.querySelector('.nw-profile-toggle-icon');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', networkState.profileCollapsed ? 'false' : 'true');
      toggleBtn.setAttribute(
        'aria-label',
        networkState.profileCollapsed ? 'Expandir painel do perfil' : 'Recolher painel do perfil'
      );
    }
    if (icon) icon.textContent = networkState.profileCollapsed ? '▾' : '▴';
  };

  window.networkToggleProfileMenu = function () {
    networkState.profileMenuOpen = !networkState.profileMenuOpen;
    const menu = document.getElementById('nw-profile-menu');
    if (menu) menu.classList.toggle('is-open', networkState.profileMenuOpen);
    const btn = document.querySelector('.nw-profile-name-btn');
    if (btn) btn.setAttribute('aria-expanded', networkState.profileMenuOpen ? 'true' : 'false');
  };

  window.networkOpenProfileEditorFromMenu = function () {
    networkState.profileMenuOpen = false;
    const menu = document.getElementById('nw-profile-menu');
    if (menu) menu.classList.remove('is-open');
    if (typeof window.networkOpenEditProfileModal === 'function') window.networkOpenEditProfileModal();
  };

  window.networkCloseChatMobile = function () {
    const cid = networkState._subscribedChatConvId || networkState.selectedConversationId;
    if (cid) unsubscribeChatForConversation(cid);
    if (networkState._chatInputAbort) {
      try {
        networkState._chatInputAbort.abort();
      } catch (_) { /* ignore */ }
      networkState._chatInputAbort = null;
    }
    networkState.activeCenter = 'feed';
    networkState.selectedConversationId = null;
    networkState.chatPeerUserId = null;
    networkState.chatPeerProfileId = null;
    document.getElementById('nw-view-feed')?.classList.add('is-active');
    document.getElementById('nw-view-chat')?.classList.remove('is-active');
    document.querySelectorAll('.nw-conv-item').forEach((n) => n.classList.remove('is-active'));
    const app = document.getElementById('nw-app');
    app?.classList.remove('nw-show-sidebar');
  };

  window.networkSelectConversation = async function (conversationId) {
    const prevSub = networkState._subscribedChatConvId;
    if (prevSub && prevSub !== conversationId) unsubscribeChatForConversation(prevSub);

    networkState.selectedConversationId = conversationId;
    networkState.activeCenter = 'chat';
    const conv = networkState.conversations.find((c) => c.id === conversationId);
    networkState.chatPeerUserId = conv?.peerUserId || null;
    networkState.chatPeerProfileId = conv?.peerProfileId || null;

    const nameEl = document.getElementById('nw-chat-header-name');
    const avEl = document.getElementById('nw-chat-header-avatar');
    const statusEl = document.getElementById('nw-chat-header-status');
    if (nameEl) nameEl.textContent = conv?.peerName || 'Chat';
    if (statusEl) statusEl.textContent = 'No Network';
    if (avEl) {
      const safeAv = conv?.peerAvatar ? sanitizeHttpUrl(conv.peerAvatar) : '';
      avEl.innerHTML = safeAv
        ? `<img src="${escapeHtml(safeAv)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
        : getAvatarFallback(conv?.peerName || '?');
    }

    document.getElementById('nw-view-feed')?.classList.remove('is-active');
    document.getElementById('nw-view-chat')?.classList.add('is-active');
    document.querySelectorAll('.nw-conv-item').forEach((n) => {
      n.classList.toggle('is-active', n.getAttribute('data-conv-id') === conversationId);
    });

    const client = getClient();
    const me = networkState.currentUser?.id;
    if (client && me) {
      await client
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', me);
    }
    await loadConversationsEnriched();
    renderConversationList(document.getElementById('nw-dm-search')?.value || '');

    if (networkState._chatInputAbort) {
      try {
        networkState._chatInputAbort.abort();
      } catch (_) { /* ignore */ }
    }
    networkState._chatInputAbort = new AbortController();
    const sig = networkState._chatInputAbort.signal;

    await loadAndRenderMessages(conversationId);
    bindChatInputListeners(sig);
    setupMessageRealtime(conversationId);
    setupPresenceChannel(conversationId);
    const app = document.getElementById('nw-app');
    if (app && window.innerWidth < 768) app.classList.remove('nw-show-sidebar');

    scrollChatToBottom();
  };

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      const sc = document.getElementById('nw-chat-scroll');
      if (sc) sc.scrollTop = sc.scrollHeight;
    });
  }

  function bindChatInputListeners(signal) {
    const ta = document.getElementById('nw-chat-input');
    if (!ta || signal.aborted) return;
    const onInput = function () {
      this.style.height = 'auto';
      this.style.height = `${Math.min(this.scrollHeight, 120)}px`;
      trackTypingPresence();
    };
    const onKeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        networkSendDm();
      }
    };
    ta.addEventListener('input', onInput, { signal });
    ta.addEventListener('keydown', onKeydown, { signal });
  }

  function trackTypingPresence() {
    const cid = networkState.selectedConversationId;
    const bundle = cid ? networkState.realtimeChannels[cid] : null;
    const pch = bundle?.presence;
    if (!pch) return;
    clearTimeout(networkState._typingDebounceTimer);
    networkState._typingDebounceTimer = setTimeout(() => {
      pch.track({ online: true, typing: true }).catch(() => {});
    }, 280);
    clearTimeout(networkState._typingClearTimer);
    networkState._typingClearTimer = setTimeout(() => {
      pch.track({ online: true, typing: false }).catch(() => {});
    }, 2200);
  }

  function updateTypingFromPresence(pch) {
    const el = document.getElementById('nw-chat-header-status');
    if (!el || !pch) return;
    const me = networkState.currentUser?.id;
    const state = pch.presenceState();
    let otherTyping = false;
    Object.keys(state).forEach((key) => {
      if (key === me) return;
      const metas = state[key];
      if (Array.isArray(metas) && metas.some((m) => m && m.typing === true)) otherTyping = true;
    });
    el.textContent = otherTyping ? 'A digitar…' : 'No Network';
  }

  function setupPresenceChannel(conversationId) {
    const client = getClient();
    const me = networkState.currentUser?.id;
    if (!client || !conversationId || !me) return;
    if (networkState.realtimeChannels[conversationId]?.presence) return;

    if (!networkState.realtimeChannels[conversationId]) networkState.realtimeChannels[conversationId] = {};

    const pch = client.channel(`chat:${conversationId}:presence`, {
      config: { presence: { key: me } },
    });

    pch
      .on('presence', { event: 'sync' }, () => updateTypingFromPresence(pch))
      .on('presence', { event: 'join' }, () => updateTypingFromPresence(pch))
      .on('presence', { event: 'leave' }, () => updateTypingFromPresence(pch));

    pch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await pch.track({ online: true, typing: false });
        } catch (_) { /* ignore */ }
      }
    });

    networkState.realtimeChannels[conversationId].presence = pch;
  }

  async function loadAndRenderMessages(conversationId) {
    const client = getClient();
    const box = document.getElementById('nw-chat-messages');
    if (!client || !box) return;

    const { data: msgs, error } = await client
      .from('messages')
      .select('id, sender_id, content, created_at, is_deleted')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      box.textContent = '';
      const p = document.createElement('p');
      p.style.color = '#888899';
      p.textContent = mapSupabaseError(error);
      box.appendChild(p);
      return;
    }

    const msgList = (msgs || []).filter((m) => m.is_deleted !== true);
    const me = networkState.currentUser?.id;

    box.textContent = '';
    if (!msgList.length) {
      const p = document.createElement('p');
      p.style.cssText = 'color:#888899;text-align:center;padding:24px';
      p.textContent = 'Sem mensagens ainda. Envie a primeira!';
      box.appendChild(p);
      return;
    }

    let lastDay = '';
    for (const m of msgList) {
      const day = dayLabelForMessage(m.created_at);
      if (day !== lastDay) {
        const sep = document.createElement('div');
        sep.className = 'nw-day-sep';
        sep.textContent = day;
        box.appendChild(sep);
        lastDay = day;
      }
      const mine = m.sender_id === me;
      const row = document.createElement('div');
      row.className = `nw-msg-row ${mine ? 'is-mine' : ''}`;
      row.dataset.msgId = String(m.id);
      const bubble = document.createElement('div');
      bubble.className = 'nw-bubble';
      fillMessageBubble(bubble, m.content, formatMsgTime(m.created_at));
      row.appendChild(bubble);
      box.appendChild(row);
    }
  }

  function setupMessageRealtime(conversationId) {
    const client = getClient();
    if (!client || !conversationId) return;
    if (networkState._subscribedChatConvId === conversationId && networkState.realtimeChannels[conversationId]?.messages) {
      return;
    }

    const prev = networkState._subscribedChatConvId;
    if (prev && prev !== conversationId) unsubscribeChatForConversation(prev);

    const me = networkState.currentUser?.id;
    const msgCh = client
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new;
          if (!m || m.is_deleted === true) return;
          if (m.sender_id === me) return;
          appendMessageBubble(m);
        }
      )
      .subscribe();

    if (!networkState.realtimeChannels[conversationId]) networkState.realtimeChannels[conversationId] = {};
    networkState.realtimeChannels[conversationId].messages = msgCh;
    networkState._subscribedChatConvId = conversationId;
  }

  function appendMessageBubble(m) {
    const box = document.getElementById('nw-chat-messages');
    if (!box) return;
    const me = networkState.currentUser?.id;
    const mine = m.sender_id === me;
    const empty = box.querySelector('p');
    if (empty && empty.textContent.includes('Sem mensagens')) empty.remove();

    const seps = box.querySelectorAll('.nw-day-sep');
    const lastSep = seps[seps.length - 1];
    const lastDay = lastSep ? lastSep.textContent.trim() : '';
    const day = dayLabelForMessage(m.created_at);
    if (day !== lastDay) {
      const sep = document.createElement('div');
      sep.className = 'nw-day-sep';
      sep.textContent = day;
      box.appendChild(sep);
    }

    const wrap = document.createElement('div');
    wrap.className = `nw-msg-row ${mine ? 'is-mine' : ''}`;
    wrap.dataset.msgId = m.id || '';
    const bubble = document.createElement('div');
    bubble.className = 'nw-bubble';
    fillMessageBubble(bubble, m.content, formatMsgTime(m.created_at));
    wrap.appendChild(bubble);
    box.appendChild(wrap);
    scrollChatToBottom();
  }

  function subscribeDmListRealtime() {
    const client = getClient();
    const me = networkState.currentUser?.id;
    if (!client || !me) return;

    unsubscribeDmListChannel();

    networkState._dmListChannel = client
      .channel('dm-conv-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          if (!row?.conversation_id) return;
          if (!networkState.conversationIdSet.has(row.conversation_id)) return;
          loadConversationsEnriched().then(() => {
            renderConversationList(document.getElementById('nw-dm-search')?.value || '');
          });
        }
      )
      .subscribe();
  }

  window.networkSendDm = async function () {
    const ta = document.getElementById('nw-chat-input');
    const text = (ta?.value || '').trim();
    const cid = networkState.selectedConversationId;
    const client = getClient();
    const me = networkState.currentUser?.id;
    if (!text || !cid || !client || !me) return;

    const sendBtn = document.getElementById('nw-chat-send');
    if (sendBtn) sendBtn.disabled = true;

    const tempId = `optimistic-${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversation_id: cid,
      sender_id: me,
      content: text,
      created_at: new Date().toISOString(),
      is_deleted: false,
    };

    const box = document.getElementById('nw-chat-messages');
    const optimisticRow = document.createElement('div');
    optimisticRow.className = 'nw-msg-row is-mine nw-msg-optimistic';
    optimisticRow.dataset.tempId = tempId;
    const optBubble = document.createElement('div');
    optBubble.className = 'nw-bubble';
    fillMessageBubble(optBubble, text, formatMsgTime(optimistic.created_at));
    optimisticRow.appendChild(optBubble);
    const empty = box?.querySelector('p');
    if (empty && empty.textContent.includes('Sem mensagens')) empty.remove();
    box?.appendChild(optimisticRow);
    if (ta) ta.value = '';
    scrollChatToBottom();

    try {
      const { data, error } = await client
        .from('messages')
        .insert({
          conversation_id: cid,
          sender_id: me,
          content: text,
        })
        .select('id, sender_id, content, created_at')
        .single();
      if (error) throw error;
      optimisticRow.classList.remove('nw-msg-optimistic');
      optimisticRow.dataset.msgId = data.id;
      optimisticRow.querySelector('.nw-msg-time').textContent = formatMsgTime(data.created_at);
      await loadConversationsEnriched();
      renderConversationList(document.getElementById('nw-dm-search')?.value || '');
    } catch (e) {
      logNetworkErr('[Network] Enviar mensagem:', e);
      optimisticRow.remove();
      if (ta) ta.value = text;
      showToast(mapSupabaseError(e), 'error');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  };

  window.openConversation = async function (targetUserId) {
    if (!targetUserId || targetUserId === networkState.currentUser?.id) return;
    try {
      const cid = await findOrCreateConversationWithPeer(targetUserId);
      if (!cid) return;
      await loadConversationsEnriched();
      renderConversationList(document.getElementById('nw-dm-search')?.value || '');
      await window.networkSelectConversation(cid);
      const app = document.getElementById('nw-app');
      if (app && window.innerWidth < 768) {
        app.classList.remove('nw-show-sidebar');
        networkState.mobileTab = 'feed';
        document.querySelectorAll('.nw-bottom-nav button').forEach((b) => b.classList.remove('is-active'));
        document.querySelector('.nw-bottom-nav [data-mtab="feed"]')?.classList.add('is-active');
      }
    } catch (e) {
      logNetworkErr('[Network] openConversation', e);
      showToast('Não foi possível abrir o chat.', 'error');
    }
  };

  window.networkStartDm = window.openConversation;

  window.networkClosePeerProfileModal = function (ev) {
    if (ev && ev.target && ev.target.id && ev.target.id !== 'nw-chat-peer-profile-modal') return;
    document.getElementById('nw-chat-peer-profile-modal')?.remove();
  };

  window.networkOpenChatPeerProfile = async function () {
    const uid = networkState.chatPeerUserId;
    if (!uid) return;
    const client = getClient();
    if (!client) return;

    document.getElementById('nw-chat-peer-profile-modal')?.remove();

    const { data: profile, error } = await client.from('profiles').select('*').eq('user_id', uid).maybeSingle();
    if (error || !profile) {
      showToast('Não foi possível carregar o perfil.', 'error');
      return;
    }

    const bioRaw = profile.bio || (Array.isArray(profile.niche) ? profile.niche.join(', ') : profile.niche) || profile.company_name || 'Sem descrição.';
    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <div class="nw-modal-overlay" id="nw-chat-peer-profile-modal" style="display:flex" onclick="networkClosePeerProfileModal(event)">
        <div class="nw-modal nw-peer-mini" onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="nw-peer-mini-title">
          <button type="button" class="nw-peer-mini-close" onclick="networkClosePeerProfileModal()" aria-label="Fechar">×</button>
          <div class="nw-avatar nw-peer-mini-av">${renderAvatar(profile)}</div>
          <h3 id="nw-peer-mini-title">${escapeHtml(profile.display_name || 'Utilizador')}</h3>
          <p class="nw-peer-mini-bio">${escapeHtml(String(bioRaw))}</p>
        </div>
      </div>`
    );
  };

  function setupFeedInfiniteScroll() {
    if (networkState._ioObserver) {
      networkState._ioObserver.disconnect();
      networkState._ioObserver = null;
    }
    const root = document.getElementById('nw-feed-scroll');
    const feed = document.getElementById('nw-feed');
    const sentinel = document.getElementById('nw-feed-sentinel');
    if (!root || !feed || !window.IntersectionObserver) return;

    const cards = feed.querySelectorAll('.nw-post-card');
    let trigger = sentinel;
    if (cards.length >= 2) trigger = cards[cards.length - 2];
    else if (cards.length === 1) trigger = cards[0];

    networkState._ioObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) window.loadMorePosts();
        });
      },
      { root, rootMargin: '80px', threshold: 0.01 }
    );
    if (trigger) networkState._ioObserver.observe(trigger);
  }

  function nwBindDmSearch() {
    const input = document.getElementById('nw-dm-search');
    if (!input || input.dataset.nwDmSearchBound) return;
    input.dataset.nwDmSearchBound = '1';
    input.addEventListener('input', () => {
      clearTimeout(networkState._dmSearchDebounce);
      networkState._dmSearchDebounce = setTimeout(() => {
        renderConversationList(input.value);
      }, 300);
    });
  }

  function nwBindMobileNav() {
    document.querySelectorAll('.nw-bottom-nav [data-mtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-mtab');
        const app = document.getElementById('nw-app');
        if (!app) return;

        if (tab === 'notifs') {
          showToast('Notificações em breve.', 'info');
          return;
        }

        networkState.mobileTab = tab;
        document.querySelectorAll('.nw-bottom-nav [data-mtab]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        if (tab === 'feed') {
          app.classList.remove('nw-show-sidebar');
          if (networkState.activeCenter === 'chat' && typeof window.networkCloseChatMobile === 'function') {
            window.networkCloseChatMobile();
          }
          return;
        }
        if (tab === 'msgs') {
          app.classList.add('nw-show-sidebar');
          return;
        }
        if (tab === 'profile') {
          app.classList.add('nw-show-sidebar');
          requestAnimationFrame(() => {
            document.querySelector('#nw-app .nw-profile-card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        }
      });
    });
  }

  window.networkHandleLikePost = async function (postId, btn) {
    const likeKey = String(postId);
    if (networkState._pendingLikePostIds.has(likeKey)) return;
    const countEl = btn.querySelector('.like-count');
    const prevLiked = btn.classList.contains('nw-liked');
    const cur = parseInt(countEl?.textContent, 10) || 0;
    btn.disabled = true;
    try {
      await toggleLike(postId);
      const liked = networkState.likedPostIds.has(likeKey);
      btn.classList.toggle('nw-liked', liked);
      const icon = btn.querySelector('span');
      if (icon) icon.textContent = liked ? '❤️' : '🤍';
      if (countEl && liked !== prevLiked) countEl.textContent = String(Math.max(0, cur + (liked ? 1 : -1)));
    } catch (err) {
      showToast(mapSupabaseError(err), 'error');
    } finally {
      btn.disabled = false;
    }
  };

  window.networkToggleComments = async function (postId, btn) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;
    const open = section.classList.toggle('is-open');
    if (open) await networkLoadComments(postId);
  };

  function renderCommentRow(c) {
    const a = c.profiles || c.author || {};
    return `
      <div class="nw-comment-item" data-comment-id="${escapeHtml(String(c.id || ''))}">
        <div class="nw-avatar nw-avatar--sm">${renderAvatar(a)}</div>
        <div class="nw-comment-body">
          <strong>${escapeHtml(a.display_name || a.full_name || '')}</strong>
          <p class="nw-comment-text">${escapeHtml(c.content)}</p>
          <span class="nw-comment-meta">${timeAgo(c.created_at)}</span>
        </div>
      </div>`;
  }

  function renderComments(comments) {
    if (!comments?.length) {
      return '<p class="nw-muted nw-comment-empty">Sem comentários ainda. Seja o primeiro!</p>';
    }
    return comments.map((c) => renderCommentRow(c)).join('');
  }

  window.networkLoadComments = async function (postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;
    if (isDemoPost(postId)) {
      list.innerHTML = '<p class="nw-muted nw-comment-empty">Demo — sem comentários ao vivo.</p>';
      return;
    }
    const client = getClient();
    if (!client) return;

    const { data: comments, error } = await client
      .from('post_comments')
      .select('*, profiles(username, display_name, avatar_url, role)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (error) {
      list.innerHTML = `<p class="nw-muted nw-comment-empty">${escapeHtml(mapSupabaseError(error))}</p>`;
      return;
    }

    list.innerHTML = renderComments(comments || []);
  };

  window.networkSubmitComment = async function (postId, input) {
    if (!input?.value.trim()) return;
    if (!networkState.currentProfile) {
      if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
      else if (typeof window.showAuthModal === 'function') window.showAuthModal('login');
      return;
    }
    const pendingKey = String(postId);
    if (networkState._pendingCommentPostIds.has(pendingKey)) return;
    const content = input.value.trim();
    input.value = '';
    const list = document.getElementById(`comments-list-${postId}`);
    const sendBtn = input.nextElementSibling;
    networkState._pendingCommentPostIds.add(pendingKey);
    input.disabled = true;
    if (sendBtn && 'disabled' in sendBtn) sendBtn.disabled = true;
    try {
      let row;
      try {
        row = await addComment(postId, content);
      } catch (e) {
        if (!isTransientCommentError(e)) throw e;
        await new Promise((resolve) => setTimeout(resolve, 250));
        row = await addComment(postId, content);
      }
      if (row && list) {
        const empty = list.querySelector('.nw-comment-empty');
        if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', renderCommentRow(row));
      }
      const countEl = document.querySelector(`[data-comments-for="${postId}"]`);
      if (countEl) countEl.textContent = String((parseInt(countEl.textContent, 10) || 0) + 1);
    } catch (e) {
      showToast(mapSupabaseError(e), 'error');
      input.value = content;
    } finally {
      networkState._pendingCommentPostIds.delete(pendingKey);
      input.disabled = false;
      if (sendBtn && 'disabled' in sendBtn) sendBtn.disabled = false;
    }
  };

  window.networkCommentKey = function (event, postId, input) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      networkSubmitComment(postId, input);
    }
  };

  window.networkOpenCreatePostModal = function () {
    if (!networkState.currentProfile) {
      if (typeof window.openAuthModal === 'function') window.openAuthModal('login');
      else if (typeof window.showAuthModal === 'function') window.showAuthModal('login');
      return;
    }
    let modal = document.getElementById('nw-create-post-modal');
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend', renderCreatePostModalHtml());
      modal = document.getElementById('nw-create-post-modal');
    }
    modal.style.display = 'flex';
    const ta = document.getElementById('nw-new-post-text');
    const fi = document.getElementById('nw-post-image-input');
    const prev = document.getElementById('nw-post-image-preview');
    if (ta) ta.value = '';
    if (fi) fi.value = '';
    if (prev) {
      prev.innerHTML = '';
      prev.hidden = true;
    }
    wireComposeModal();
    ta?.focus();
  };

  window.networkCloseCreatePostModal = function (event) {
    if (event && event.target && event.target.id && event.target.id !== 'nw-create-post-modal') return;
    const modal = document.getElementById('nw-create-post-modal');
    if (modal) modal.style.display = 'none';
  };

  window.networkSubmitNewPost = async function () {
    const ta = document.getElementById('nw-new-post-text');
    const content = (ta?.value || '').trim();
    const fileIn = document.getElementById('nw-post-image-input');
    const file = fileIn?.files?.[0] || null;
    if (!content) {
      showToast('Escreva algo antes de publicar.', 'info');
      return;
    }
    if (content.length > 1000) {
      showToast('Texto demasiado longo (máx. 1000 caracteres).', 'error');
      return;
    }
    const pub = document.getElementById('nw-publish-btn');
    if (pub) pub.disabled = true;
    try {
      const post = await createPost(content, file);
      networkCloseCreatePostModal();
      document.getElementById('nw-feed')?.insertAdjacentHTML('afterbegin', renderPost(post));
      setupFeedInfiniteScroll();
      showToast('Publicação criada com sucesso.', 'success');
    } catch (e) {
      showToast(mapSupabaseError(e), 'error');
      if (pub) pub.disabled = false;
    }
  };

  window.showAuthModal = function (mode) {
    const view = mode === 'signup' ? 'signup' : 'login';
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal(view);
      return;
    }
    if (import.meta.env.DEV) {
      console.warn('[Network] openAuthModal indisponível — confirme que auth.js carrega sem erros (Consola).');
    }
  };

  window.loadMorePosts = async function () {
    if (!networkState.hasMore || networkState.isLoading) return;
    const now = Date.now();
    if (now < networkState._loadMoreCooldown) return;
    networkState._loadMoreCooldown = now + 600;
    const nextPage = networkState.page + 1;
    const prevCount = networkState.posts.length;
    await loadNetworkPosts('all', nextPage);
    networkState.page = nextPage;
    const feed = document.getElementById('nw-feed');
    const newOnes = networkState.posts.slice(prevCount);
    newOnes.forEach((post) => feed?.insertAdjacentHTML('beforeend', renderPost(post)));
    setupFeedInfiniteScroll();
  };

  async function renderNetworkTab() {
    const container = document.getElementById('network-content');
    if (!container) {
      if (import.meta.env.DEV) console.warn('[Network] #network-content não encontrado no DOM.');
      return;
    }

    container.style.minHeight = '70vh';
    container.style.background = '#0a0a0f';

    try {
      await initNetworkAuth();
      if (typeof window.destroyNetworkTab === 'function') window.destroyNetworkTab();

      if (!networkState.currentUser) {
        container.innerHTML = renderGuestCTA();
        return;
      }

      networkState.page = 0;
      networkState.posts = [];
      networkState.activeCenter = 'feed';
      networkState.selectedConversationId = null;

      container.innerHTML = `
      <section class="nw-app" id="nw-app" style="min-height:72vh;background:#0a0a0f;color:#e8e8f0">
        <div id="nw-offline-banner" class="nw-offline-banner" hidden role="status">Sem conexão. As ações voltam quando estiver online.</div>
        <aside class="nw-sidebar">${renderSidebar()}</aside>
        <div class="nw-center" style="min-height:50vh" role="main" aria-label="Feed e conversas do Network">
          <div class="nw-center-view is-active" id="nw-view-feed">${renderFeed()}</div>
          <div class="nw-center-view" id="nw-view-chat">${renderChat(null)}</div>
        </div>
        <aside class="nw-right">${renderRightPanel()}</aside>
        <nav class="nw-bottom-nav" aria-label="Navegação inferior do Network">
          <button type="button" data-mtab="feed" class="is-active" aria-label="Abrir feed"><span class="nw-mtab-ico" aria-hidden="true">🏠</span><span class="nw-mtab-label">Feed</span></button>
          <button type="button" data-mtab="msgs" aria-label="Abrir mensagens"><span class="nw-mtab-ico" aria-hidden="true">💬</span><span class="nw-mtab-label">Mensagens</span></button>
          <button type="button" data-mtab="notifs" aria-label="Notificações"><span class="nw-mtab-ico" aria-hidden="true">🔔</span><span class="nw-mtab-label">Notificações</span></button>
          <button type="button" data-mtab="profile" aria-label="Perfil e lista de conversas"><span class="nw-mtab-ico" aria-hidden="true">👤</span><span class="nw-mtab-label">Perfil</span></button>
        </nav>
      </section>`;

      bindNetworkOnlineOffline();
      refreshNetworkOfflineUI();

      nwBindDmSearch();
      nwBindMobileNav();

      const useFeedCache =
        feedCache &&
        feedCache.userId === networkState.currentUser.id &&
        feedCache.filter === 'all';

      if (useFeedCache) {
        networkState.posts = feedCache.posts.map((p) => ({
          ...p,
          author: { ...(p.author || {}) },
        }));
        networkState.page = 0;
        networkState.activeFilter = 'all';
        networkState.hasMore = !!feedCache.hasMore;
        paintFeedFromState();
      } else {
        await loadNetworkPosts('all', 0);
      }

      await hydrateLikedPosts();

      await loadConversationsEnriched();
      renderConversationList('');
      subscribeToNetworkUpdates();
      subscribeDmListRealtime();
      setupFeedInfiniteScroll();
    } catch (err) {
      logNetworkErr('[Network] renderNetworkTab:', err);
      container.innerHTML = `
        <div style="min-height:50vh;padding:2rem;background:#1a0a0f;color:#fecaca;font-family:system-ui,sans-serif">
          <p><strong>Não foi possível carregar o Network.</strong></p>
          <p style="color:#fca5a5;font-size:0.9rem;margin-top:8px">${escapeHtml(String(err?.message || err))}</p>
          <p style="color:#888899;font-size:0.85rem;margin-top:12px">Abra a consola do navegador (F12) para mais detalhes ou recarregue a página.</p>
        </div>`;
    }
  }

  window.renderNetworkTab = renderNetworkTab;
})();
