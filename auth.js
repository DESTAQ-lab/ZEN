// auth.js — DestaQ | Supabase Auth + Modal (sessão, login, cadastro, recuperação)

(function () {
  'use strict';

  const CFG = window.DESTAQ_CONFIG || {};
  const SB_URL = (CFG.supabaseUrl || CFG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const SB_KEY = (CFG.supabaseKey || CFG.SUPABASE_ANON_KEY || '').trim();

  function appOriginForAuthLinks() {
    try {
      const explicit = String(CFG.AUTH_REDIRECT_ORIGIN || '').trim().replace(/\/+$/, '');
      if (explicit) return explicit;
      const app = String(CFG.APP_URL || '').trim().replace(/\/+$/, '');
      if (app) return app;
      return (window.location?.origin || '').replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  }

  function buildAuthRedirectUrl(hash = '') {
    const origin = appOriginForAuthLinks();
    if (!origin) return `${window.location?.origin || ''}/${hash ? `#${hash}` : ''}`;
    try {
      const url = new URL('/', origin);
      if (hash) url.hash = hash;
      return url.toString();
    } catch (_) {
      const cleanOrigin = String(origin).replace(/\/+$/, '');
      return `${cleanOrigin}/${hash ? `#${hash}` : ''}`;
    }
  }

  function safeErrMsg(err) {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err.message != null) return String(err.message);
    return '';
  }
  function logAuthErr(tag, err) {
    if (import.meta.env.DEV) console.error(tag, err);
    else {
      const m = safeErrMsg(err);
      if (m) console.error(tag, m);
      else console.error(tag);
    }
  }
  function logAuthWarn(tag, err) {
    if (import.meta.env.DEV) console.warn(tag, err);
    else {
      const m = safeErrMsg(err);
      if (m) console.warn(tag, m);
      else console.warn(tag);
    }
  }

  let _client = null;
  let _authListener = null;
  let _escapeBound = false;
  let _navAuthDelegationBound = false;
  let _configWarned = false;
  let _sdkWarned = false;
  let _topMenuBound = false;

  function resolveCreateClient() {
    const g = window.supabase;
    if (g && typeof g.createClient === 'function') return g.createClient.bind(g);
    if (g && g.default && typeof g.default.createClient === 'function') return g.default.createClient.bind(g.default);
    return null;
  }

  function getSupabaseClient() {
    if (_client) return _client;
    const createClient = resolveCreateClient();
    if (!createClient) {
      if (!_sdkWarned) {
        _sdkWarned = true;
        if (import.meta.env.DEV) console.warn('[Auth] SDK @supabase/supabase-js não encontrado (createClient).');
      }
      return null;
    }
    if (!SB_URL || !SB_KEY || SB_URL.includes('SEU_PROJETO') || SB_KEY.includes('SUA_CHAVE')) {
      if (!_configWarned) {
        _configWarned = true;
        if (import.meta.env.DEV) {
          console.warn('[Auth] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (ou variáveis de build).');
        }
      }
      return null;
    }
    try {
      _client = createClient(SB_URL, SB_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      });
      window.supabaseClient = _client;
    } catch (err) {
      logAuthErr('[Auth] Falha ao criar cliente Supabase:', err);
      return null;
    }
    return _client;
  }

  window.DESTAQ_getSupabaseClient = getSupabaseClient;
  window.supabaseClient = getSupabaseClient();

  let _currentUser = null;
  let _currentProfile = null;

  function emitAuthChange(user) {
    document.dispatchEvent(new CustomEvent('destaq:authChange', { detail: { user } }));
  }

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

  async function loadCurrentProfile(userId) {
    const client = getSupabaseClient();
    if (!client || !userId) return null;
    try {
      const { data } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      _currentProfile = data || null;
      return _currentProfile;
    } catch (_) {
      return null;
    }
  }

  function getCurrentUser() {
    return _currentUser;
  }
  window.getCurrentUser = getCurrentUser;

  function escapeHtml(s) {
    if (s == null || typeof s !== 'string') return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function displayNameFromUser(user) {
    if (!user) return '';
    const meta = user.user_metadata || {};
    const n = meta.full_name || meta.name || meta.display_name;
    if (n && String(n).trim()) return String(n).trim();
    if (user.email) return user.email.split('@')[0];
    return 'Conta';
  }

  function updateNavbar(user) {
    const btnsWrap = document.querySelector('.nav-buttons');
    if (!btnsWrap) return;
    if (user) {
      const profile = _currentProfile || {};
      const nameRaw = profile.display_name || profile.full_name || displayNameFromUser(user);
      const label = escapeHtml(nameRaw);
      const initial = (String(nameRaw || user.email || 'U').trim().charAt(0) || 'U').toUpperCase();
      const avatarUrl = sanitizeHttpUrl(profile.avatar_url);
      const avatarHtml = avatarUrl
        ? `<img src="${escapeHtml(avatarUrl)}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover;display:block" aria-hidden="true">`
        : `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#EC4899);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px" aria-hidden="true">${escapeHtml(initial)}</div>`;
      btnsWrap.innerHTML = `
        <div class="dq-top-user-menu" style="position:relative;display:flex;align-items:center;justify-content:flex-end">
          <button
            type="button"
            id="dq-top-user-trigger"
            style="display:flex;align-items:center;gap:10px;border:1px solid rgba(0,0,0,0.1);background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer"
            aria-expanded="false"
            aria-label="Abrir opções do perfil"
          >
            ${avatarHtml}
            <span style="font-family:'Satoshi',sans-serif;font-size:0.9rem;font-weight:600;color:var(--text-primary);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>
            <span aria-hidden="true" style="font-size:0.72rem;color:#64748b">▾</span>
          </button>
          <div
            id="dq-top-user-dropdown"
            style="display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:190px;background:#fff;border:1px solid rgba(0,0,0,0.1);border-radius:10px;box-shadow:0 10px 24px rgba(15,23,42,0.14);padding:6px;z-index:50020"
          >
            <button type="button" data-dq-top-action="edit" style="width:100%;text-align:left;border:none;background:transparent;padding:9px 10px;border-radius:8px;cursor:pointer;font-size:0.86rem;color:#1f2937">Editar perfil</button>
            <button type="button" data-dq-top-action="logout" style="width:100%;text-align:left;border:none;background:transparent;padding:9px 10px;border-radius:8px;cursor:pointer;font-size:0.86rem;color:#1f2937">Sair</button>
          </div>
        </div>`;
      bindTopUserMenu();
    } else {
      btnsWrap.innerHTML = `
        <button type="button" class="btn-ghost" data-auth-open="login" data-track="nav_login_click" aria-label="Entrar na conta">Entrar</button>
        <button type="button" class="btn-gold" data-auth-open="signup" data-track="nav_signup_click" aria-label="Criar conta gratuita">Começar grátis</button>`;
    }
  }

  function openProfileEditorFromTopMenu() {
    const openEditor = () => {
      if (typeof window.networkOpenEditProfileModal === 'function') {
        window.networkOpenEditProfileModal();
      }
    };
    if (typeof window.activateTab === 'function') {
      window.activateTab('network', true, true);
      setTimeout(openEditor, 180);
      return;
    }
    openEditor();
  }

  function bindTopUserMenu() {
    const trigger = document.getElementById('dq-top-user-trigger');
    const menu = document.getElementById('dq-top-user-dropdown');
    if (!trigger || !menu) return;

    const closeMenu = () => {
      menu.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      menu.style.display = 'block';
      trigger.setAttribute('aria-expanded', 'true');
    };

    trigger.onclick = (e) => {
      e.preventDefault();
      if (menu.style.display === 'block') closeMenu();
      else openMenu();
    };

    menu.onclick = (e) => {
      const btn = e.target.closest('[data-dq-top-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-dq-top-action');
      if (action === 'edit') openProfileEditorFromTopMenu();
      if (action === 'logout') window.authSignOut && window.authSignOut();
      closeMenu();
    };

    if (!_topMenuBound) {
      _topMenuBound = true;
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.dq-top-user-menu')) closeMenu();
      });
    }
  }

  /**
   * Cliques em Entrar / Começar grátis: delegação no próprio `.nav-buttons` (sobrevive a innerHTML
   * nos filhos) + fase capture para correr antes de outros handlers. Z-index do header em style.css
   * mantém estes cliques acima de camadas full-screen da Network.
   */
  function bindNavAuthOpenDelegation() {
    if (_navAuthDelegationBound) return;
    _navAuthDelegationBound = true;

    function handleNavAuthClick(e) {
      const raw = e.target;
      const node = raw && raw.nodeType === Node.TEXT_NODE ? raw.parentElement : raw;
      if (!node || typeof node.closest !== 'function') return;
      const btn = node.closest('[data-auth-open]');
      if (!btn) return;
      const mode = btn.getAttribute('data-auth-open');
      if (mode !== 'login' && mode !== 'signup') return;
      const host = btn.closest('.nav-buttons');
      if (!host) return;
      e.preventDefault();
      if (mode === 'signup') {
        window.location.href = buildAuthRedirectUrl();
        return;
      }
      if (typeof window.openAuthModal === 'function') window.openAuthModal(mode);
      else if (import.meta.env.DEV) console.error('[DestaQ Auth] openAuthModal não está disponível.');
    }

    function attachToNavButtonsHost() {
      const host = document.querySelector('.nav-buttons');
      if (!host || host.dataset.dqAuthNavBound === '1') return;
      host.dataset.dqAuthNavBound = '1';
      host.addEventListener('click', handleNavAuthClick, true);
    }

    attachToNavButtonsHost();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachToNavButtonsHost);
    }
  }

  function bindGlobalEscapeOnce() {
    if (_escapeBound) return;
    _escapeBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const ov = document.getElementById('dq-auth-overlay');
      if (!ov || ov.style.display !== 'flex') return;
      e.preventDefault();
      closeAuthModal();
    });
  }

  function resetLoginErrorStyle() {
    const el = document.getElementById('dq-login-error');
    if (!el) return;
    el.style.background = 'rgba(239,68,68,0.1)';
    el.style.borderColor = 'rgba(239,68,68,0.3)';
    el.style.color = '#fca5a5';
  }

  function mapAuthErrorMessage(err) {
    if (!err) return 'Algo deu errado. Tente de novo.';
    const code = err.code || '';
    const msg = err.message || '';
    const table = {
      invalid_credentials: 'Email ou senha incorretos.',
      'Invalid login credentials': 'Email ou senha incorretos.',
      email_not_confirmed: 'Confirme seu email antes de entrar.',
      'Email not confirmed': 'Confirme seu email antes de entrar.',
      user_already_registered: 'Este email já está cadastrado. Tente entrar ou recuperar a senha.',
      'User already registered': 'Este email já está cadastrado.',
      weak_password: 'Senha fraca. Use letras, números e pelo menos 8 caracteres.',
      same_password: 'A nova senha não pode ser igual à anterior.',
      over_request_rate_limit: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
      request_timeout: 'Tempo esgotado. Verifique sua conexão.',
    };
    if (table[msg]) return table[msg];
    if (table[code]) return table[code];
    if (/network|fetch|failed/i.test(msg)) return 'Sem conexão com o servidor. Verifique a internet.';
    return msg || 'Não foi possível concluir a operação.';
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function upsertUserProfile(client, userId, name, email) {
    const baseUser = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    const username = `${baseUser}_${Math.random().toString(36).slice(2, 7)}`;
    /** `profiles.user_id` = auth.users.id; `profiles.id` é o ID público (ex.: author_id na network). */
    const row = {
      user_id: userId,
      display_name: name,
      full_name: name,
      username,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from('profiles').upsert(row, { onConflict: 'user_id' });
    if (error) {
      logAuthWarn('[Auth] profiles.upsert:', error);
      if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
        PopupSystem.toast({
          icon: 'ℹ️',
          title: 'Conta criada; perfil será completado no painel.',
          duration: 4000,
        });
      }
    }
  }

  function injectModalHtml() {
    if (document.getElementById('dq-auth-overlay')) return;
    const html = `
    <div id="dq-auth-overlay" role="dialog" aria-modal="true" aria-labelledby="dq-auth-title" style="position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:20px" onclick="closeAuthModal(event)">
      <div id="dq-auth-modal" style="background:#0f0d1f;border:1px solid rgba(139,92,246,0.3);border-radius:20px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.6)" onclick="event.stopPropagation()">

        <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08)">
          <button type="button" id="dq-tab-login" onclick="switchAuthTab('login')" style="flex:1;padding:18px;background:none;border:none;color:#8B5CF6;font-size:0.9rem;cursor:pointer;font-family:'Inter',sans-serif;border-bottom:2px solid #8B5CF6;font-weight:600">Entrar</button>
          <button type="button" id="dq-tab-signup" onclick="switchAuthTab('signup')" style="flex:1;padding:18px;background:none;border:none;color:rgba(255,255,255,0.4);font-size:0.9rem;cursor:pointer;font-family:'Inter',sans-serif;border-bottom:2px solid transparent;font-weight:600">Criar conta</button>
        </div>

        <div id="dq-form-login" style="padding:28px">
          <h3 id="dq-auth-title" style="color:#fff;font-family:'Satoshi',sans-serif;font-size:1.3rem;margin:0 0 20px;font-weight:800">Bem-vindo de volta 👋</h3>
          <div id="dq-login-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:10px 14px;border-radius:8px;font-size:0.85rem;margin-bottom:14px" role="alert"></div>
          <label for="dq-login-email" class="visually-hidden">Email</label>
          <input type="email" id="dq-login-email" autocomplete="email" placeholder="seu@email.com" style="width:100%;padding:12px 16px;border-radius:10px;margin-bottom:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.9rem;outline:none;box-sizing:border-box;font-family:'Inter',sans-serif">
          <label for="dq-login-pass" class="visually-hidden">Senha</label>
          <input type="password" id="dq-login-pass" autocomplete="current-password" placeholder="Senha" style="width:100%;padding:12px 16px;border-radius:10px;margin-bottom:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.9rem;outline:none;box-sizing:border-box;font-family:'Inter',sans-serif">
          <button type="button" onclick="authForgotPassword()" style="background:none;border:none;color:rgba(139,92,246,0.8);font-size:0.8rem;cursor:pointer;padding:0;margin-bottom:18px;font-family:'Inter',sans-serif">Esqueci minha senha</button>
          <button type="button" id="dq-login-btn" onclick="authDoLogin()" style="width:100%;padding:13px;border-radius:100px;background:linear-gradient(135deg,#8B5CF6,#EC4899);border:none;color:#fff;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:'Inter',sans-serif;transition:opacity 0.2s">Entrar</button>
        </div>

        <div id="dq-form-signup" style="display:none;padding:28px">
          <h3 style="color:#fff;font-family:'Satoshi',sans-serif;font-size:1.3rem;margin:0 0 20px;font-weight:800">Criar sua conta gratuita</h3>
          <div id="dq-signup-error" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:10px 14px;border-radius:8px;font-size:0.85rem;margin-bottom:14px" role="alert"></div>
          <input type="text" id="dq-signup-name" autocomplete="name" placeholder="Nome completo" style="width:100%;padding:12px 16px;border-radius:10px;margin-bottom:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.9rem;outline:none;box-sizing:border-box;font-family:'Inter',sans-serif">
          <input type="email" id="dq-signup-email" autocomplete="email" placeholder="seu@email.com" style="width:100%;padding:12px 16px;border-radius:10px;margin-bottom:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.9rem;outline:none;box-sizing:border-box;font-family:'Inter',sans-serif">
          <input type="password" id="dq-signup-pass" autocomplete="new-password" placeholder="Senha (mín. 8 caracteres)" style="width:100%;padding:12px 16px;border-radius:10px;margin-bottom:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.9rem;outline:none;box-sizing:border-box;font-family:'Inter',sans-serif">
          <input type="password" id="dq-signup-pass2" autocomplete="new-password" placeholder="Confirmar senha" style="width:100%;padding:12px 16px;border-radius:10px;margin-bottom:18px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.9rem;outline:none;box-sizing:border-box;font-family:'Inter',sans-serif">
          <button type="button" id="dq-signup-btn" onclick="authDoSignup()" style="width:100%;padding:13px;border-radius:100px;background:linear-gradient(135deg,#8B5CF6,#EC4899);border:none;color:#fff;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:'Inter',sans-serif">Criar conta grátis</button>
          <p style="color:rgba(255,255,255,0.3);font-size:0.75rem;text-align:center;margin-top:14px">Ao criar, você concorda com os termos de uso da DestaQ.</p>
        </div>

      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    document.getElementById('dq-login-pass')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') authDoLogin();
    });
    document.getElementById('dq-signup-pass2')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') authDoSignup();
    });
  }

  function openAuthModal(view) {
    bindGlobalEscapeOnce();
    injectModalHtml();
    const ov = document.getElementById('dq-auth-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    switchAuthTab(view || 'login');
    setTimeout(() => {
      const inp = view === 'signup' ? document.getElementById('dq-signup-name') : document.getElementById('dq-login-email');
      inp?.focus();
    }, 80);
  }

  function closeAuthModal(event) {
    if (event && event.target && event.target.id !== 'dq-auth-overlay') return;
    const ov = document.getElementById('dq-auth-overlay');
    if (ov) ov.style.display = 'none';
    document.body.style.overflow = '';
    try {
      delete window.__destaqPendingConfirmEmail;
    } catch (_) {}
    clearErrors();
    resetLoginErrorStyle();
  }

  function switchAuthTab(tab) {
    const isLogin = tab !== 'signup';
    const fl = document.getElementById('dq-form-login');
    const fs = document.getElementById('dq-form-signup');
    if (fl) fl.style.display = isLogin ? 'block' : 'none';
    if (fs) fs.style.display = isLogin ? 'none' : 'block';
    const tabLogin = document.getElementById('dq-tab-login');
    const tabSignup = document.getElementById('dq-tab-signup');
    if (tabLogin && tabSignup) {
      tabLogin.style.color = isLogin ? '#8B5CF6' : 'rgba(255,255,255,0.4)';
      tabLogin.style.borderBottomColor = isLogin ? '#8B5CF6' : 'transparent';
      tabSignup.style.color = !isLogin ? '#8B5CF6' : 'rgba(255,255,255,0.4)';
      tabSignup.style.borderBottomColor = !isLogin ? '#8B5CF6' : 'transparent';
    }
    clearErrors();
    resetLoginErrorStyle();
  }

  function clearErrors() {
    ['dq-login-error', 'dq-signup-error'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
      }
    });
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.setAttribute('aria-busy', loading ? 'true' : 'false');
    btn.style.opacity = loading ? '0.6' : '1';
    btn.textContent = loading ? 'Aguarde...' : btnId === 'dq-login-btn' ? 'Entrar' : 'Criar conta grátis';
  }

  async function authDoLogin() {
    const email = document.getElementById('dq-login-email')?.value?.trim();
    const pass = document.getElementById('dq-login-pass')?.value;
    resetLoginErrorStyle();
    if (!email || !pass) {
      showError('dq-login-error', 'Preencha email e senha.');
      return;
    }
    if (!isValidEmail(email)) {
      showError('dq-login-error', 'Digite um email válido.');
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      showError('dq-login-error', 'Serviço indisponível. Verifique .env / variáveis VITE_SUPABASE_* e o script do Supabase.');
      return;
    }
    setLoading('dq-login-btn', true);
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
      if (error) {
        showError('dq-login-error', mapAuthErrorMessage(error));
        return;
      }
      const user = data.user || data.session?.user;
      if (!user) {
        showError('dq-login-error', 'Sessão não retornada. Tente novamente.');
        return;
      }
      _currentUser = user;
      await loadCurrentProfile(user.id);
      updateNavbar(_currentUser);
      emitAuthChange(_currentUser);
      const ov = document.getElementById('dq-auth-overlay');
      if (ov) ov.style.display = 'none';
      document.body.style.overflow = '';
      if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
        PopupSystem.toast({ icon: '✅', title: 'Login realizado!', duration: 2800 });
      }
    } catch (err) {
      logAuthErr('[Auth] login', err);
      showError('dq-login-error', mapAuthErrorMessage(err));
    } finally {
      setLoading('dq-login-btn', false);
    }
  }

  async function authDoSignup() {
    const name = document.getElementById('dq-signup-name')?.value?.trim();
    const email = document.getElementById('dq-signup-email')?.value?.trim();
    const pass = document.getElementById('dq-signup-pass')?.value;
    const pass2 = document.getElementById('dq-signup-pass2')?.value;
    if (!name || !email || !pass) {
      showError('dq-signup-error', 'Preencha todos os campos.');
      return;
    }
    if (!isValidEmail(email)) {
      showError('dq-signup-error', 'Email inválido.');
      return;
    }
    if (name.length < 2) {
      showError('dq-signup-error', 'Informe seu nome completo.');
      return;
    }
    if (pass.length < 8) {
      showError('dq-signup-error', 'Use senha com pelo menos 8 caracteres.');
      return;
    }
    if (pass !== pass2) {
      showError('dq-signup-error', 'As senhas não conferem.');
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      showError('dq-signup-error', 'Serviço indisponível. Verifique .env / variáveis VITE_SUPABASE_*.');
      return;
    }
    setLoading('dq-signup-btn', true);
    try {
      const redirect = buildAuthRedirectUrl();
      const { data, error } = await client.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo: redirect,
          data: { full_name: name, display_name: name },
        },
      });
      if (error) {
        showError('dq-signup-error', mapAuthErrorMessage(error));
        return;
      }
      if (data.user) {
        await upsertUserProfile(client, data.user.id, name, email);
      }
      if (data.user && !data.session) {
        window.__destaqPendingConfirmEmail = email;
        const box = document.getElementById('dq-form-signup');
        if (box) {
          box.innerHTML = `
            <div style="text-align:center;padding:20px 0">
              <div style="font-size:3rem;margin-bottom:16px" aria-hidden="true">✉️</div>
              <h3 style="color:#fff;font-family:'Satoshi',sans-serif;margin:0 0 12px">Verifique seu email</h3>
              <p style="color:rgba(255,255,255,0.6);font-size:0.9rem;margin-bottom:1rem">Enviamos um link para <strong>${escapeHtml(email)}</strong>.</p>
              <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px;border-color:rgba(255,255,255,0.2)" onclick="authResendConfirmation()">Reenviar email de confirmação</button>
            </div>`;
        }
      } else if (data.session && data.user) {
        _currentUser = data.user;
        await loadCurrentProfile(data.user.id);
        updateNavbar(_currentUser);
        emitAuthChange(_currentUser);
        const ov = document.getElementById('dq-auth-overlay');
        if (ov) ov.style.display = 'none';
        document.body.style.overflow = '';
        if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
          PopupSystem.toast({ icon: '🎉', title: 'Conta criada! Bem-vindo.', duration: 3200 });
        }
      }
    } catch (err) {
      logAuthErr('[Auth] signup', err);
      showError('dq-signup-error', mapAuthErrorMessage(err));
    } finally {
      setLoading('dq-signup-btn', false);
    }
  }

  async function authResendConfirmation() {
    const email =
      (typeof window.__destaqPendingConfirmEmail === 'string' && window.__destaqPendingConfirmEmail.trim()) ||
      document.getElementById('dq-signup-email')?.value?.trim() ||
      document.getElementById('dq-login-email')?.value?.trim();
    if (!email || !isValidEmail(email)) {
      if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
        PopupSystem.toast({ icon: '⚠️', title: 'Informe um email válido na aba Entrar.', duration: 3500 });
      }
      return;
    }
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: buildAuthRedirectUrl() },
      });
      if (error) throw error;
      if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
        PopupSystem.toast({ icon: '📧', title: 'Email de confirmação reenviado.', duration: 3500 });
      }
    } catch (e) {
      logAuthWarn('[Auth] resend', e);
      if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
        PopupSystem.toast({ icon: '⚠️', title: mapAuthErrorMessage(e), duration: 4000 });
      }
    }
  }

  async function authForgotPassword() {
    const email = document.getElementById('dq-login-email')?.value?.trim();
    resetLoginErrorStyle();
    if (!email) {
      showError('dq-login-error', 'Digite seu email acima para recuperar a senha.');
      return;
    }
    if (!isValidEmail(email)) {
      showError('dq-login-error', 'Email inválido.');
      return;
    }
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const redirectTo = buildAuthRedirectUrl('reset');
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        showError('dq-login-error', mapAuthErrorMessage(error));
        return;
      }
      showError('dq-login-error', '📧 Se o email existir, você receberá o link de recuperação.');
      const el = document.getElementById('dq-login-error');
      if (el) {
        el.style.background = 'rgba(16,185,129,0.1)';
        el.style.borderColor = 'rgba(16,185,129,0.3)';
        el.style.color = '#6ee7b7';
      }
    } catch (e) {
      showError('dq-login-error', mapAuthErrorMessage(e));
    }
  }

  async function authSignOut() {
    const client = getSupabaseClient();
    try {
      if (client) await client.auth.signOut({ scope: 'global' });
    } catch (e) {
      logAuthWarn('[Auth] signOut', e);
    }
    _currentUser = null;
    updateNavbar(null);
    emitAuthChange(null);
    document.body.style.overflow = '';
    if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
      PopupSystem.toast({ icon: '👋', title: 'Sessão encerrada.', duration: 2500 });
    }
  }

  async function restoreSession() {
    const client = getSupabaseClient();
    if (!client) {
      updateNavbar(null);
      return;
    }

    try {
      const {
        data: { session },
        error,
      } = await client.auth.getSession();
      if (error) logAuthWarn('[Auth] getSession', error);
      if (session?.user) {
        _currentUser = session.user;
        await loadCurrentProfile(session.user.id);
        updateNavbar(_currentUser);
        emitAuthChange(_currentUser);
      } else {
        _currentUser = null;
        _currentProfile = null;
        updateNavbar(null);
      }
    } catch (e) {
      logAuthErr('[Auth] getSession', e);
      updateNavbar(null);
    }

    if (_authListener && typeof _authListener.subscription?.unsubscribe === 'function') {
      _authListener.subscription.unsubscribe();
    }

    const { data } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          _currentUser = session.user;
          await loadCurrentProfile(session.user.id);
          updateNavbar(_currentUser);
          emitAuthChange(_currentUser);
        }
      } else if (event === 'SIGNED_OUT') {
        _currentUser = null;
        _currentProfile = null;
        updateNavbar(null);
        emitAuthChange(null);
      }
    });
    _authListener = data;
  }

  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.switchAuthTab = switchAuthTab;
  window.authDoLogin = authDoLogin;
  window.authDoSignup = authDoSignup;
  window.authForgotPassword = authForgotPassword;
  window.authSignOut = authSignOut;
  window.authResendConfirmation = authResendConfirmation;

  bindNavAuthOpenDelegation();

  const style = document.createElement('style');
  style.textContent = '.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}';
  document.head.appendChild(style);

  document.addEventListener('destaq:profileUpdated', (ev) => {
    const p = ev?.detail?.profile;
    if (p) _currentProfile = p;
    if (_currentUser && p) {
      _currentUser = {
        ..._currentUser,
        user_metadata: {
          ...(_currentUser.user_metadata || {}),
          full_name: p.display_name || _currentUser.user_metadata?.full_name,
          display_name: p.display_name || _currentUser.user_metadata?.display_name,
          avatar_url: p.avatar_url || '',
        },
      };
    }
    updateNavbar(_currentUser);
  });

  function boot() {
    restoreSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
