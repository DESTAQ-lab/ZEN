function __safeErrMsg(err) {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err.message != null) return String(err.message);
    return '';
}
function __logErr(tag, err) {
    if (import.meta.env.DEV) console.error(tag, err);
    else {
        const m = __safeErrMsg(err);
        if (m) console.error(tag, m);
        else console.error(tag);
    }
}
function __logWarn(tag, err) {
    if (import.meta.env.DEV) console.warn(tag, err);
    else {
        const m = __safeErrMsg(err);
        if (m) console.warn(tag, m);
        else console.warn(tag);
    }
}

window.addEventListener("unhandledrejection", e => {
    __logErr("[DestaQ Promise Error]", e.reason);
});

try {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    // Registro do Plugin ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // ===== SPLASH SCREEN ANIMATION =====
    const splashScreen = document.getElementById("splash-screen");
    let splashTimeout;

    if (splashScreen) {
        document.body.style.overflow = "hidden";
        
        const forceDismissSplash = () => {
            if (splashScreen && splashScreen.parentNode) {
                splashScreen.classList.add('splash-screen-done');
                setTimeout(() => {
                    splashScreen.remove();
                    const revealTargets = document.querySelectorAll(".gsap-title, .gsap-section, .hero-content, .tab-pane");
                    if (revealTargets.length) {
                        gsap.to(revealTargets, {
                            opacity: 1,
                            visibility: "visible",
                            duration: 0.5,
                            stagger: 0.1
                        });
                    }
                }, 1000);
            }
            document.body.style.overflow = "";
            document.body.style.opacity = "1";
        };
        // Reduzi o timeout de segurança para 3s para garantir que o usuário não espere muito
        splashTimeout = setTimeout(forceDismissSplash, 3000);
        
        const splashChars = document.querySelectorAll('.splash-char');
        const splashLogo = document.querySelector('.splash-logo');
        
        let splashTl = gsap.timeline({
            onComplete: () => {
                if (splashTimeout) clearTimeout(splashTimeout);
                forceDismissSplash(); // Tira a cortina do fluxo do browser
            }
        });

    // 1. Efeito máquina de escrever nativa das letras DestaQ
    splashTl.to(splashChars, {
        opacity: 1,
        duration: 0.1,    
        stagger: 0.1,    
        ease: "none"
    })
    // 2. Pausa imersiva de 0.8s
    .to({}, { duration: 0.8 })
    // 3. Pulse (1 -> 1.06 -> 1) 
    .to(splashLogo, {
        scale: 1.06,
        duration: 0.4, 
        yoyo: true,
        repeat: 1,
        ease: "sine.inOut"
    })
    // 4. Fade-out da tela inteira em 0.9s deixando o site aparecer
    .to(splashScreen, {
        opacity: 0,
        duration: 0.9,
        ease: "power2.inOut"
    }, "+=0.1");
}

// ===== BACKGROUND CANVAS (Wireframe Orgânico Light Theme) =====
const bgCanvas = document.getElementById("bg-canvas");
if (bgCanvas) {
    const bgCtx = bgCanvas.getContext("2d");
    let width, height, particles;

    function initBg() {
        width = window.innerWidth;
        height = window.innerHeight;
        bgCanvas.width = width;
        bgCanvas.height = height;
        particles = [];
        const count = width < 768 ? 40 : 80;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width, y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 1.5 + 0.5
            });
        }
    }

    function animateBg() {
        bgCtx.clearRect(0, 0, width, height);
        bgCtx.fillStyle = "rgba(192, 155, 50, 0.4)"; // Ouro escuro/creme
        
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
            
            bgCtx.beginPath();
            bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            bgCtx.fill();
            
            for (let j = i + 1; j < particles.length; j++) {
                let p2 = particles[j];
                let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if (dist < 150) {
                    bgCtx.beginPath();
                    bgCtx.strokeStyle = `rgba(192, 155, 50, ${(1 - dist/150) * 0.15})`;
                    bgCtx.moveTo(p.x, p.y);
                    bgCtx.lineTo(p2.x, p2.y);
                    bgCtx.stroke();
                }
            }
        }
        requestAnimationFrame(animateBg);
    }
    initBg();
    animateBg();
    window.addEventListener("resize", initBg);
}

// ===== ANIMATED HERO CANVAS (GSAP FRAME-BY-FRAME) =====
// ===== OWL SCROLL SEQUENCE (CORUJA) =====
const owlCanvas = document.getElementById("hero-canvas");
if (owlCanvas) {
    const ctx = owlCanvas.getContext("2d");

    const heroFrameModules = import.meta.glob("./Imagens/quero_que_troque_202604240334_*.jpg", {
        eager: true,
        import: "default",
    });
    const heroFrameUrls = Object.keys(heroFrameModules)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((k) => heroFrameModules[k]);
    const frameCount = heroFrameUrls.length || 150;
    const currentFrame = (index) => {
        const i = Math.max(0, Math.min(frameCount - 1, index));
        if (heroFrameUrls.length) return heroFrameUrls[i];
        return `Imagens/quero_que_troque_202604240334_${i.toString().padStart(3, "0")}.jpg`;
    };

    const images = [];
    const owlAnimation = { frame: 0 };

    for (let i = 0; i < frameCount; i++) {
        const img = new Image();
        img.src = currentFrame(i);
        images.push(img);
    }

    images[0].onload = renderOwl;
    // Forçar o render caso a imagem já esteja no cache
    if (images[0].complete) {
        renderOwl();
    }

    function ensureHeroCanvasSize() {
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const rect = owlCanvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (owlCanvas.width !== w || owlCanvas.height !== h) {
            owlCanvas.width = w;
            owlCanvas.height = h;
        }
    }

    function renderOwl() {
        if (!images[owlAnimation.frame]) return;
        const img = images[owlAnimation.frame];
        if (!img.complete || img.naturalWidth === 0) return;

        ensureHeroCanvasSize();
        const scale = Math.max(owlCanvas.width / img.width, owlCanvas.height / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (owlCanvas.width - drawW) / 2;
        const y = (owlCanvas.height - drawH) / 2;

        ctx.clearRect(0, 0, owlCanvas.width, owlCanvas.height);
        ctx.drawImage(img, x, y, drawW, drawH);
    }

    gsap.to(owlAnimation, {
        frame: frameCount - 1,
        snap: "frame",
        ease: "none",
        duration: 12,
        repeat: -1,
        onUpdate: renderOwl
    });

    window.addEventListener("resize", renderOwl);
}

const polygonContainer = document.getElementById('floating-container');

// ===== TAB NAVIGATION SYSTEM (DEEP-LINKING) =====
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');

const tabMap = {
    "home": { id: "aba-home", title: "DestaQ | Ecossistema B2B" },
    "produtos": { id: "aba-produtos", title: "DestaQ — Produtos" },
    "comunidade": { id: "aba-comunidade", title: "DestaQ — Comunidade" },
    "network": { id: "aba-network", title: "DestaQ — Network" },
    "plataformas": { id: "aba-plataformas", title: "DestaQ — Plataformas" }
};

// Progress Bar Helpers
function progressStart() {
    const bar = document.getElementById('nav-progress');
    if (!bar) return;
    bar.style.opacity = '1';
    if (typeof gsap !== 'undefined') {
        gsap.fromTo(bar, { width: '0%' }, { width: '65%', duration: 0.4, ease: 'power2.out' });
    }
}

function progressDone() {
    const bar = document.getElementById('nav-progress');
    if (!bar) return;
    if (typeof gsap !== 'undefined') {
        gsap.to(bar, { width: '100%', duration: 0.2, onComplete: () => {
            gsap.to(bar, { opacity: 0, delay: 0.2, onComplete: () => bar.style.width = '0%' });
        }});
    }
}

// Skeleton Templates
const skeletonTemplates = {
    product: `
        <div class="catalog-card glass-panel skeleton-product" style="min-height: 280px; padding: 24px;">
            <div class="skeleton" style="width: 100%; height: 160px; margin-bottom: 20px;"></div>
            <div class="skeleton" style="width: 80%; height: 24px; margin-bottom: 12px;"></div>
            <div class="skeleton" style="width: 60%; height: 16px; margin-bottom: 8px;"></div>
            <div class="skeleton" style="width: 40%; height: 16px;"></div>
        </div>
    `,
    network: `
        <div class="post-card glass-panel network-post skeleton-network" style="display: flex; gap: 16px; padding: 24px;">
            <div class="skeleton" style="width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;"></div>
            <div style="flex-grow: 1;">
                <div class="skeleton" style="width: 40%; height: 20px; margin-bottom: 8px;"></div>
                <div class="skeleton" style="width: 90%; height: 14px; margin-bottom: 6px;"></div>
                <div class="skeleton" style="width: 75%; height: 14px;"></div>
            </div>
        </div>
    `,
    stat: `
        <div class="stat-card glass-panel skeleton-stat" style="padding: 24px; text-align: center;">
            <div class="skeleton" style="width: 80%; height: 48px; margin: 0 auto 12px;"></div>
            <div class="skeleton" style="width: 50%; height: 14px; margin: 0 auto;"></div>
        </div>
    `
};

function showSkeletons(containerId, count, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Array(count).fill(skeletonTemplates[type] || '').join('');
}

function removeSkeletons(containerId, type, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const skeletons = container.querySelectorAll('.skeleton-' + type);
    if (skeletons.length > 0 && typeof gsap !== 'undefined') {
        gsap.to(skeletons, { opacity: 0, duration: 0.2, onComplete: callback });
    } else {
        if (callback) callback();
    }
}

// Error State
function showErrorState(containerId, retryFnName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="error-state">
            <p>Não conseguimos carregar os dados agora.</p>
            <button onclick="${retryFnName}()">Tentar novamente</button>
        </div>`;
    if (typeof DEQ !== 'undefined' && DEQ.setState) {
        DEQ.setState('thinking', 'Ops! Tentando buscar os dados novamente...');
    }
}

// Mock definitions for tab needs
const tabNeedsData = {
    "aba-home": false,
    "aba-produtos": true, 
    "aba-comunidade": true, 
    "aba-network": true, 
    "aba-plataformas": false
};

function bindHomeCtas() {
    const catalogBtn = document.getElementById('home-cta-catalogo');
    const consultoraBtn = document.getElementById('home-cta-consultora');
    const solicitarDemoBtn = document.getElementById('home-cta-solicitar-demo');
    const consultoraFinalBtn = document.getElementById('home-cta-falar-consultora-final');

    const openConsultoraPopup = async () => {
        await activateTab('produtos', true, true);
        if (typeof window.openProductRequestModal === 'function') {
            window.openProductRequestModal();
        }
    };

    if (catalogBtn && !catalogBtn.dataset.bound) {
        catalogBtn.dataset.bound = '1';
        catalogBtn.addEventListener('click', () => {
            activateTab('produtos', true, true);
        });
    }

    if (consultoraBtn && !consultoraBtn.dataset.bound) {
        consultoraBtn.dataset.bound = '1';
        consultoraBtn.addEventListener('click', openConsultoraPopup);
    }

    if (solicitarDemoBtn && !solicitarDemoBtn.dataset.bound) {
        solicitarDemoBtn.dataset.bound = '1';
        solicitarDemoBtn.addEventListener('click', openConsultoraPopup);
    }

    if (consultoraFinalBtn && !consultoraFinalBtn.dataset.bound) {
        consultoraFinalBtn.dataset.bound = '1';
        consultoraFinalBtn.addEventListener('click', openConsultoraPopup);
    }
}

async function activateTab(tabKey, updateHistory = false, scrollToContainer = false) {
    const tabData = tabMap[tabKey];
    if (!tabData) return;

    // Estado global de aba ativa para estilos robustos (evita depender de :has).
    document.body.classList.toggle('dq-tab-network-active', tabData.id === 'aba-network');
    
    // Progress Start
    progressStart();

    const tabLink = Array.from(navTabs).find(t => t.getAttribute('data-target') === tabData.id);

    // Atualiza classes ativas nos botoes (home não possui nav-tab visual)
    navTabs.forEach(t => t.classList.remove('active'));
    if (tabLink) {
        tabLink.classList.add('active');
    }
    
    const currentPane = document.querySelector('.tab-pane.active');
    const newPane = document.getElementById(tabData.id);

    // 1. Fade out da aba atual (se existir e for diferente)
    if (currentPane && currentPane !== newPane) {
        if (currentPane.id === 'aba-network' && typeof window.destroyNetworkTab === 'function') {
            window.destroyNetworkTab();
        }
        if (typeof gsap !== 'undefined') {
            await gsap.to(currentPane, { opacity: 0, y: 8, duration: 0.2 });
        }
        currentPane.classList.remove('active');
        currentPane.style.display = 'none';
    }

    // 2. Prepara nova aba
    if (newPane) {
        newPane.style.display = 'block';
        newPane.style.opacity = '0';
        newPane.classList.add('active');
        
        // Simular Skeletons
        if (tabNeedsData[tabData.id]) {
             if (tabData.id === 'aba-network') showSkeletons('network-content', 3, 'network');
        }

        // 3. Fade In
        // Importante: não deixar `transform` no .tab-pane após a animação — quebra `position: fixed`
        // do ScrollTrigger (pin da cena infra) e pode deixar o ecrã branco durante o pin.
        if (typeof gsap !== 'undefined') {
            await gsap.fromTo(newPane, { opacity: 0, y: -8 }, {
                opacity: 1,
                y: 0,
                duration: 0.3,
                ease: 'power2.out',
                onComplete: () => {
                    gsap.set(newPane, { clearProps: 'transform' });
                }
            });
        } else {
            newPane.style.opacity = '1';
        }
    }

    // Título dinâmico (Armazenado na base para a Animação da Coruja)
    window.siteBaseTitle = tabData.title;

    // API de Histórico usando Hash (Deep Linking Seguro)
    if (updateHistory) {
        history.pushState({ tab: tabKey }, "", `#${tabKey}`);
    }

    // 4. Buscar dados do Supabase (Real load)
    if (tabNeedsData[tabData.id]) {
        if (tabData.id === 'aba-produtos') await loadProductMarketplace();
        if (tabData.id === 'aba-network') await loadNetworkFeed();
        if (tabData.id === 'aba-comunidade') initCommunityTab();
    }

    // 5. Refresh ScrollTrigger
    setTimeout(() => {
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        if (tabData.id === 'aba-home') {
            window.dispatchEvent(new Event('resize'));
        }
        if (scrollToContainer) {
            const container = document.getElementById('tabs-container');
            if (container) window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });
        }
    }, 50);

    // 6. Notificar mascote e Analytics
    if (typeof trackEvent === 'function') trackEvent('tab_view', { tab_name: tabData.id });
    document.dispatchEvent(new CustomEvent('destaq:tab-change', { detail: { tab: tabKey } }));

    // Progress Done
    progressDone();
}

// 1. Inicialização por Deep-Linking (Carregamento da página)
let currentHash = window.location.hash.replace('#', '').toLowerCase();
if (currentHash === '') {
    currentHash = "home";
}
const initialTab = tabMap[currentHash] ? currentHash : "home";
// Após todos os scripts síncronos (ex.: network.js) para deep-link #network e renderNetworkTab
document.addEventListener('DOMContentLoaded', () => {
    bindHomeCtas();
    activateTab(initialTab, false, false);
});

// 2. Eventos de clique nas abas
navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = tab.getAttribute('data-target');
        const tabKey = Object.keys(tabMap).find(key => tabMap[key].id === targetId);
        
        if (tabKey) {
            activateTab(tabKey, true, true);
        }
    });
});

// 3. Voltar e avançar no navegador (Popstate)
window.addEventListener("popstate", (e) => {
    const tab = e.state?.tab || "home";
    activateTab(tab, false, false);
});

// 4. Hash manual (ex.: link externo #network sem passar pelo nav-tab)
window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '').toLowerCase();
    if (tabMap[h]) activateTab(h, false, false);
});

// ===== PRICING MULTI-TOGGLE SYSTEM =====
const pricingToggle = document.getElementById('pricing-toggle');
const pricingAmounts = document.querySelectorAll('.pricing-card .amount');
const toggleLabels = document.querySelectorAll('.toggle-label');

if (pricingToggle) {
    pricingToggle.addEventListener('change', (e) => {
        const isAnnual = e.target.checked;
        if (typeof trackEvent === 'function') trackEvent('pricing_toggle', { period: isAnnual ? 'anual' : 'mensal' });
        
        // Handlers de label color
        toggleLabels[0].classList.toggle('active-label', !isAnnual);
        toggleLabels[1].classList.toggle('active-label', isAnnual);

        // Transição horizontal suave do valor (sem "flip" brusco)
        pricingAmounts.forEach((amountEl) => {
            amountEl.classList.remove('price-slide-in', 'price-slide-out');
            void amountEl.offsetWidth;

            amountEl.classList.add('price-slide-out');

            setTimeout(() => {
                amountEl.innerText = isAnnual
                    ? amountEl.getAttribute('data-annual')
                    : amountEl.getAttribute('data-monthly');

                amountEl.classList.remove('price-slide-out');
                amountEl.classList.add('price-slide-in');
            }, 160);

            setTimeout(() => {
                amountEl.classList.remove('price-slide-in');
            }, 420);
        });
    });
}

// ===== OTIMIZAÇÃO E PERFORMANCE =====
// GSAP Config: force3D move operações para GPU. autoSleep poupa CPU
gsap.config({ autoSleep: 60, force3D: true });

// Criação do Escopo de Contexto via MatchMedia para Lidar de Forma Segura com Responsividade e Acessibilidade (Reduce Motion)
let mm = gsap.matchMedia();

// Media Query combinada: Telas Desktop cujo Sistema não pede Redução Estrutural (Acessibilidade)
mm.add("(min-width: 769px) and (prefers-reduced-motion: no-preference)", () => {

// Animação do título principal GSAP quando entra na tela
if (document.querySelector(".gsap-title")) {
    gsap.fromTo(".gsap-title", 
        { y: 100, opacity: 0.01 }, // Estado inicial seguro (quase invisível mas presente)
        {
            scrollTrigger: {
                trigger: ".gsap-section",
                start: "top 80%",
                end: "top 50%",
                scrub: 1,
            },
            y: 0,
            opacity: 1,
            duration: 1
        }
    );
}

// Stagger (animação encadeada) nos cards
if (document.querySelector(".gsap-card")) {
    gsap.fromTo(".gsap-card", 
        { y: 50, opacity: 0.01 },
        {
            scrollTrigger: {
                trigger: ".cards-wrapper",
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.2,
            ease: "back.out(1.7)"
        }
    );
}

// ===== PARALLAX DA HERO SECTION =====
if (document.querySelector(".hero")) {
    const heroScrollTrigger = {
        trigger: ".hero",
        start: "top top",
        end: "bottom center",
        scrub: 1
    };

    if (document.querySelector(".hero h1")) {
        gsap.to(".hero h1", {
            scrollTrigger: heroScrollTrigger,
            y: -50,
            opacity: 0.3,
            scale: 1.1,
            filter: "blur(8px)"
        });
    }

    if (document.querySelector(".hero-subtitle")) {
        gsap.to(".hero-subtitle", {
            scrollTrigger: heroScrollTrigger,
            y: -30,
            opacity: 0.3,
            scale: 1.1,
            filter: "blur(6px)"
        });
    }

    if (document.querySelector(".hero-bg")) {
        gsap.to(".hero-bg", {
            scrollTrigger: heroScrollTrigger,
            y: -80,
            opacity: 0.3,
            scale: 1.1,
            filter: "blur(12px)"
        });
    }
}
}); // <--- Fim do Contexto MatchMedia Desktop


// ===== INICIALIZAÇÃO AOS =====
// Usado para animações que apenas 'aparecem' na tela 
AOS.init({
    duration: 1000, 
    once: true, // A animação ocorre apenas na primeira vez que rola a tela
    offset: 50, // Gatilho dispara quando o elemento está a 50px de entrar na tela
    easing: 'ease-out-cubic'
});

// ===== INJEÇÃO E ELEMENTOS FLUTUANTES 3D =====
const floatingContainer = document.getElementById('floating-container');
const shapes = ['shape-square', 'shape-triangle', 'shape-hexagon'];

if (floatingContainer) {
    // Gerar polígonos geométricos vazios (reduzido no iOS para performance)
    const maxPolygons = isIOS ? 4 : 20;
    for (let i = 0; i < maxPolygons; i++) {
        const shape = document.createElement('div');
        const randomShapeClass = shapes[Math.floor(Math.random() * shapes.length)];
        shape.classList.add('floating-shape', randomShapeClass);
        floatingContainer.appendChild(shape);
    }
}

gsap.utils.toArray(".floating-shape").forEach((el) => {
    // Posição inicial randômica e opacidade matemática
    gsap.set(el, {
        x: () => gsap.utils.random(0, window.innerWidth),
        y: () => gsap.utils.random(0, window.innerHeight),
        z: () => gsap.utils.random(-200, 200),
        opacity: () => gsap.utils.random(0.04, 0.12),
        scale: () => gsap.utils.random(0.5, 1.2),
        rotation: () => gsap.utils.random(0, 360)
    });

    const tl = gsap.timeline({
        repeat: -1,
        yoyo: true, // Movement backwards to origins ensuring loop
        defaults: { ease: "sine.inOut" }
    });

    // Movimentação livre: X, Y, Giro livre de até 360 e profundidade simulada
    tl.to(el, {
        x: () => `+=${gsap.utils.random(-250, 250)}`,
        y: () => `+=${gsap.utils.random(-250, 250)}`,
        rotation: () => `+=${gsap.utils.random(-360, 360)}`,
        z: () => `+=${gsap.utils.random(-100, 100)}`,
        duration: () => gsap.utils.random(8, 15) // Duração lenta gerando tranquilidade zen
    });
});

// ===== ANIMAÇÕES DA ABA PRODUTOS (FADE INS E TIMELINES) =====
mm.add("(min-width: 769px) and (prefers-reduced-motion: no-preference)", () => {
    // Fade IN elements using GSAP ScrollTrigger
    const fadeElements = gsap.utils.toArray('.fade-in');
    fadeElements.forEach(el => {
        gsap.fromTo(el, 
            { y: 30, opacity: 0 }, 
            {
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%"
                },
                y: 0,
                opacity: 1,
                duration: 0.8,
                ease: "power2.out"
            }
        );
    });

    const feedCol = document.querySelector(".feed-col");
    const communityPosts = document.querySelectorAll(".community-post");
    if (feedCol && communityPosts.length) {
        gsap.from(communityPosts, {
            scrollTrigger: {
                trigger: feedCol,
                start: "top 80%",
            },
            y: 40,
            opacity: 0,
            duration: 0.6,
            stagger: 0.15,
            ease: "power2.out"
        });
    }
});

// ===== CONTADORES (STATS) E CONFETTI =====
function animateCounters(root = document) {
    const stats = root.querySelectorAll('.stat-counter');
    let animationsCompleted = 0;

    stats.forEach(stat => {
        const target = parseFloat(stat.getAttribute('data-target'));
        const decimals = parseInt(stat.getAttribute('data-decimals') || 0);
        const isCurrency = stat.classList.contains('stat-currency');
        const wrapper = stat.closest('.stat-wrapper');

        const countObj = { val: 0 };

        gsap.to(countObj, {
            val: target,
            duration: 2,
            ease: "power2.out",
            onUpdate: function() {
                const formatado = countObj.val.toLocaleString('pt-BR', {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
                stat.textContent = formatado;
            },
            onComplete: function() {
                animationsCompleted++;
                
                // Se for a stat do "2B+", dispara confetti!
                if(isCurrency) {
                    dispararConfetti();
                    if (typeof trackEvent === 'function') trackEvent('stats_counter_complete');
                    document.dispatchEvent(new CustomEvent('destaq:stats-complete'));
                }
            }
        });
    });
}

// Gatilho GSAP para iniciar os Stats (cada .stats-bar anima só os contadores daquela seção)
document.querySelectorAll('.stats-bar').forEach((bar) => {
    ScrollTrigger.create({
        trigger: bar,
        start: "top 80%",
        once: true,
        onEnter: () => {
            const section = bar.closest('.stats-section');
            animateCounters(section || document);
        }
    });
});

function dispararConfetti() {
    if(typeof confetti !== 'undefined') {
        const duration = 1.5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999, useWorker: !isIOS };

        function randomInRange(min, max) { return Math.random() * (max - min) + min; }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }
}


// ===== BOTÕES INTERATIVOS (RIPPLE E HOVER ADAPTADO PARA CORES) =====
const interactiveButtons = document.querySelectorAll('.btn-gold, .btn-ghost');

interactiveButtons.forEach(btn => {
    // Apenas botões Dourados ganham pulse/glow intenso por estética
    if (btn.classList.contains('btn-gold')) {
        let hoverAction = gsap.timeline({ paused: true, repeat: -1, yoyo: true });
        
        hoverAction.to(btn, {
            scale: 1.05,
            boxShadow: "0 15px 30px rgba(245, 197, 66, 0.6)", // Glow dourado forte
            duration: 0.5,
            ease: "sine.inOut"
        });

        btn.addEventListener('mouseenter', () => hoverAction.play());
        
        btn.addEventListener('mouseleave', () => {
            hoverAction.pause();
            gsap.to(btn, {
                scale: 1,
                boxShadow: "0 4px 15px rgba(245, 197, 66, 0.4)",
                duration: 0.4,
                ease: "power2.out"
            });
        });
    }

    // Efeito de Colisão/Clique: Ripple em TODOS os botões
    btn.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.classList.add('ripple-btn');
        
        const size = Math.max(rect.width, rect.height) * 2.5; 
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        // Ajusta cor da água do ripple baseado no botão
        ripple.style.backgroundColor = btn.classList.contains('btn-gold') ? "rgba(255, 255, 255, 0.5)" : "rgba(245, 197, 66, 0.2)";
        
        this.appendChild(ripple);

        gsap.to(ripple, {
            scale: 1, 
            opacity: 0,
            duration: 0.6,
            ease: "power2.out",
            onComplete: () => ripple.remove()
        });
    });
});

// ===== NAVBAR (FIXA, INDICADOR E LÓGICA DE SCROLL) =====
const nav = document.querySelector('.dq-nav');
const logo = document.querySelector('.dq-logo');
if (logo) {
    logo.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab('home', true, false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
// `navTabs` já foi declarada na linha 46, evite redeclaração.
const indicator = document.querySelector('.nav-indicator');

// Estado da Navigation para evitar GSAP chamadas de forma descontrolada
let isNavScrolled = false;

window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        document.body.classList.add('dq-nav-retracted');
        if (!isNavScrolled) {
            isNavScrolled = true;
            gsap.to(nav, {
                backgroundColor: "rgba(13, 17, 23, 0.95)", // Glass de #0D1117 na rolagem
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                duration: 0.3
            });
            gsap.to(logo, { scale: 0.8, color: "var(--accent-gold)", duration: 0.5, ease: "back.out(1.5)" });
        }
    } else {
        document.body.classList.remove('dq-nav-retracted');
        if (isNavScrolled) {
            isNavScrolled = false;
            gsap.to(nav, {
                backgroundColor: "transparent",
                borderBottom: "1px solid transparent",
                duration: 0.3
            });
            gsap.to(logo, { scale: 1, color: "#ffffff", duration: 0.5, ease: "power2.out" });
        }
    }
});

// Atualização das Abas
function updateActiveTab(tab) {
    navTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
}

function moveIndicator(tab) {
    if (!tab || !indicator) return;
    updateActiveTab(tab);
    const tabRect = tab.getBoundingClientRect();
    const navRect = tab.parentElement?.getBoundingClientRect();
    if (!navRect) return;
    indicator.style.width = `${tabRect.width}px`;
    indicator.style.transform = `translateX(${Math.max(0, tabRect.left - navRect.left)}px)`;
}

if (navTabs.length > 0) {
    moveIndicator(navTabs[0]);
}

window.addEventListener('resize', () => {
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) moveIndicator(activeTab);
});

// Scroll suave via cliques do Nav
navTabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.preventDefault();
        
        moveIndicator(this);
        
        const targetId = this.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
            // Compensa os 80px do header
            const topOffset = targetSection.getBoundingClientRect().top + window.pageYOffset - 80;
            window.scrollTo({
                top: topOffset,
                behavior: 'smooth'
            });
        }
    });
});

// Sincronizar Abas guiadas pelo Scroll nativo com ScrollTrigger
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');

const sections = document.querySelectorAll('section[id]');
sections.forEach(sec => {
    ScrollTrigger.create({
        trigger: sec,
        start: "top 30%", // Quando cruzar o topo na tela
        end: "bottom 30%",
        onToggle: self => {
            if(self.isActive) {
                const id = sec.getAttribute('id');
                const matchingTab = document.querySelector(`.nav-tab[href="#${id}"]`);
                if(matchingTab) {
                    try {
                        if (typeof moveIndicator === 'function') moveIndicator(matchingTab);
                        else updateActiveTab(matchingTab);
                    } catch (_) {
                        updateActiveTab(matchingTab);
                    }
                }

                // Altera a cor do progresso visual com base no bloco ativo
                if (id === 'hero' || id === 'plataformas') {
                    progressBar.style.backgroundColor = 'var(--accent-pink)';
                } else if (id === 'gsap' || id === 'aos') {
                    progressBar.style.backgroundColor = 'var(--accent-blue)';
                } else {
                    progressBar.style.backgroundColor = 'var(--accent-pink)';
                }
            }
        }
    });
});

// Atualiza a altura do indicador de progresso preenchendo de cima pra baixo atrelado ao Global Ticker (Perf FPS)
const scrollDepthMarks = { 25: false, 50: false, 75: false, 100: false };
gsap.ticker.add(() => {
    let docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
        let scrollPercent = (window.scrollY / docHeight) * 100;
        // Evita overflow visual causado pelo rubber-banding cravando nos absolutos via gsap util
        progressBar.style.height = `${gsap.utils.clamp(0, 100, scrollPercent)}%`;
        
        [25, 50, 75, 100].forEach(mark => {
            if (scrollPercent >= mark && !scrollDepthMarks[mark]) {
                scrollDepthMarks[mark] = true;
                if (typeof trackEvent === 'function') trackEvent('scroll_depth', { percent: mark });
            }
        });
    }
});

// Clique responsivo na barra para navegar (Scroll Behavior)
if (progressContainer) {
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const clickY = e.clientY - rect.top; // Posição clicada (pixels) baseada no topo da barra
        const clickPercent = clickY / rect.height; // Proporção 0 a 1
        
        const targetScroll = clickPercent * (document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    });
}

// ===== GSAP IMAGES (REVEAL, ZOOM & ROTATION) =====
const gsapImages = document.querySelectorAll('.gsap-img');

gsapImages.forEach(img => {
    // Configuração Inicial de Estado Zero
    gsap.set(img, {
        clipPath: "inset(0 100% 0 0)", // Puxado todo pra esquerda tornando invisível
        scale: 1.2,                    // Começa grande
        rotation: 0                    // Rotacionado zero graus
    });

    // Pega a customização no layout para variar entre girar muito (360) ou fixo
    const spinTarget = img.classList.contains('spin-reveal') ? 360 : 0;

    // A Animação Mágica exigida no Scroll
    gsap.to(img, {
        scrollTrigger: {
            trigger: img.parentElement, // Box da imagem (sempre visível estruturalmente)
            start: "top 80%"
        },
        clipPath: "inset(0 0% 0 0)", // Revelação Total da direita para esquerda em um piscar
        scale: 1,                    // Zoom-out resolvido
        rotation: spinTarget,        // Rotacionando pro eixo final (0 ou 360)
        duration: 1,
        ease: "power3.inOut"         // Curva acelerada no meio e amortecida nas beiradas
    });
});

// ===== AVANCED TEXT ANIMATIONS =====

// Helper recursivo super seguro para quebrar caracters (Preserva tags <br> ou <span> internos)
function splitToChars(container) {
    const nodes = Array.from(container.childNodes);
    nodes.forEach(node => {
        if (node.nodeType === 3) { // Node de Texto puro
            const text = node.textContent;
            const frag = document.createDocumentFragment();
            text.split('').forEach(char => {
                if (char === '\n') return;
                const span = document.createElement('span');
                span.innerHTML = char === ' ' ? '&nbsp;' : char;
                span.className = 'char';
                span.style.display = 'inline-block';
                frag.appendChild(span);
            });
            node.replaceWith(frag);
        } else if (node.nodeType === 1) { // Node HTML
            splitToChars(node);
        }
    });
}

// 1. EFEITO TYPEWRITER (Letra por Letra)
document.querySelectorAll('.typewriter-text').forEach(el => {
    splitToChars(el);
    el.classList.add('has-cursor'); // Adiciona Cursor Mágico
    
    const chars = el.querySelectorAll('.char');
    gsap.set(chars, { opacity: 0 }); // Todo o texto invisível
    
    gsap.to(chars, {
        scrollTrigger: {
            trigger: el,
            start: "top 85%"
        },
        opacity: 1,
        duration: 0.05,
        stagger: 0.05,
        ease: "none"
    });
});

// 2. EFEITO SPLIT COM BLUR, SCALE E ROTATION (Animações Avançadas)
document.querySelectorAll('.advanced-stagger-text').forEach(el => {
    splitToChars(el);
    const chars = el.querySelectorAll('.char');
    
    // Status zero conforme exigências
    gsap.set(chars, { 
        opacity: 0, 
        y: 50, 
        scale: 0.5, 
        rotation: -20,
        filter: "blur(10px)" 
    });
    
    gsap.to(chars, {
        scrollTrigger: {
            trigger: el,
            start: "top 85%"
        },
        opacity: 1,
        y: 0,
        scale: 1,
        rotation: 0,
        filter: "blur(0px)",
        duration: 0.8,
        stagger: 0.05,
        ease: "back.out(1.7)"
    });
});

// 3. EFEITO DE LINHAS/PALAVRAS EM DIFERENTES DIREÇÕES
document.querySelectorAll('.split-line-text').forEach(el => {
    const words = el.innerText.split(' ');
    el.innerHTML = '';
    
    words.forEach(word => {
        // Wrapper mask box
        const wrap = document.createElement('span');
        wrap.style.display = 'inline-block';
        wrap.style.overflow = 'hidden';
        wrap.style.marginRight = '12px'; // Espaçamento de palavras

        const wordNode = document.createElement('span');
        wordNode.innerHTML = word;
        wordNode.className = 'word';
        wordNode.style.display = 'inline-block';
        
        wrap.appendChild(wordNode);
        el.appendChild(wrap);
    });

    const wordsNodes = el.querySelectorAll('.word');
    // Randomiza vinda the cima, debaixo, da esquerda ou direita!
    gsap.set(wordsNodes, {
        y: () => (Math.random() > 0.5 ? 60 : -60),
        opacity: 0
    });

    gsap.to(wordsNodes, {
        scrollTrigger: {
            trigger: el,
            start: "top 85%"
        },
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out"
    });
});

// =========================================================================
// POLIMENTOS FINAIS: RIPPLE, AOS, PROGRESS SIDEBAR, SPLIT-TEXT FOOTER E HOVERS
// =========================================================================

// 1. Inicializa AOS (Fade Up em Elementos Estáticos Secundários)
if (typeof AOS !== 'undefined') {
    AOS.init({ once: true, offset: 50 });
} else {
    document.querySelectorAll("[data-aos]").forEach(el => el.style.opacity = "1");
}

// 2. Efeito Ripple (Onda em Botões CTA)
document.querySelectorAll('button, .ripple-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
        let rect = e.target.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        let ripples = document.createElement('span');
        ripples.className = 'ripple-span';
        ripples.style.left = x + 'px';
        ripples.style.top = y + 'px';
        ripples.style.width = Math.max(rect.width, rect.height) * 2 + 'px';
        ripples.style.height = ripples.style.width;
        
        this.appendChild(ripples);
        
        // Remove limpo apos animação
        setTimeout(() => { ripples.remove(); }, 600);
    });
});

// 3. Gold Button Pulse Hover (Animação Constante e Pausa)
document.querySelectorAll('.btn-gold').forEach(btn => {
    const pulseAnim = gsap.to(btn, {
        scale: 1.04,
        boxShadow: "0 0 20px rgba(245, 197, 66, 0.4)",
        repeat: -1,
        yoyo: true,
        duration: 1.2,
        ease: "sine.inOut"
    });
    
    // Pausam o GSAP no Hover para o mouse acomodar, voltam a pulsar ao sair
    btn.addEventListener('mouseenter', () => pulseAnim.pause());
    btn.addEventListener('mouseleave', () => pulseAnim.play());
});

// 4. Progress Sidebar e ScrollTo
const trackScroll = ScrollTrigger.create({
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
        gsap.set(".progress-fill-line", { height: `${self.progress * 100}%` });
    }
});

// Ao clicar nos Pontos Navegadores da Sidebar (Smooth global scroll)
document.querySelectorAll('.nav-dot').forEach(dot => {
    dot.addEventListener('click', function() {
        // Zera o highlight antigo
        document.querySelectorAll('.nav-dot').forEach(d => d.classList.remove('active'));
        this.classList.add('active');

        const target = this.getAttribute('data-scroll-to');
        if(target) {
            gsap.to(window, {
                duration: 1,
                scrollTo: { y: target, offsetY: 0 },
                ease: "power2.inOut"
            });
        }
    });
});

// 5. Neural Split Text: Revelação caractere por caractere (Simulando Text-Split)
document.querySelectorAll('.neural-split-text').forEach(el => {
    const chars = el.innerText.split('');
    el.innerHTML = '';
    chars.forEach(char => {
        const charHtml = char === ' ' ? '&nbsp;' : char;
        el.innerHTML += `<span class="neural-char">${charHtml}</span>`;
    });
    
    gsap.to(el.querySelectorAll('.neural-char'), {
        scrollTrigger: {
            trigger: el,
            start: "top 95%"
        },
        opacity: 1,
        duration: 0.1,
        stagger: 0.05,
        ease: "steps(1)" // efeito particionado, seco
    });
});

} catch (e) {
    document.body.classList.add("no-gsap");
    __logErr("[DestaQ GSAP Error]", e);
}

// ===== 2ª ANIMAÇÃO: background frame-by-frame (mesma lógica da hero, usando Imagens1) =====
(function initInfraFrameLoopScene() {
    const infraFrameModules = import.meta.glob("./assets/Imagens1/Owl_carrying_box_202604231805_*.jpg", {
        eager: true,
        import: "default",
    });
    const infraFrameUrls = Object.keys(infraFrameModules)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((k) => infraFrameModules[k]);
    const INFRA_FRAME_COUNT = infraFrameUrls.length || 80;
    const INFRA_LOOP_SECONDS = 4.2;

    let infraTween = null;
    let images = [];
    let isBootstrapped = false;
    let resizeTimer = null;
    const infraAnimation = { frame: 0 };

    function infraFrameUrl(index) {
        const i = Math.max(0, Math.min(INFRA_FRAME_COUNT - 1, index));
        if (infraFrameUrls.length) return infraFrameUrls[i];
        return `assets/Imagens1/Owl_carrying_box_202604231805_${String(i).padStart(3, "0")}.jpg`;
    }

    function getInfraContext() {
        const home = document.getElementById("aba-home");
        const bgWrap = document.querySelector(".infra-video-bg-wrap");
        const canvas = document.getElementById("infra-bg-canvas");
        if (!home || !bgWrap || !canvas) return null;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        return { home, bgWrap, canvas, ctx };
    }

    function ensureCanvasSize(canvas) {
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 1200;
        const cssH = canvas.clientHeight || canvas.parentElement?.clientHeight || 600;
        const w = Math.max(1, Math.round(cssW * dpr));
        const h = Math.max(1, Math.round(cssH * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
    }

    function renderFrame() {
        const infra = getInfraContext();
        if (!infra) return;
        const { home, bgWrap, canvas, ctx } = infra;
        if (home.style.display === "none" || !home.classList.contains("active")) return;

        ensureCanvasSize(canvas);
        bgWrap.classList.add("infra-canvas-active");

        const frameIndex = Math.max(0, Math.min(INFRA_FRAME_COUNT - 1, Math.round(infraAnimation.frame)));
        const img = images[frameIndex];
        if (!img || !img.complete || img.naturalWidth === 0) return;

        const cw = canvas.width;
        const ch = canvas.height;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) * 0.5;
        const dy = (ch - dh) * 0.5;

        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    function preloadFrames() {
        images = [];
        for (let i = 0; i < INFRA_FRAME_COUNT; i++) {
            const img = new Image();
            img.decoding = "async";
            img.src = infraFrameUrl(i);
            images.push(img);
        }
        if (images[0]) {
            images[0].onload = () => renderFrame();
            if (images[0].complete) renderFrame();
        }
    }

    function stopLoop() {
        if (infraTween) {
            infraTween.kill();
            infraTween = null;
        }
    }

    function startLoop() {
        const infra = getInfraContext();
        if (!infra) return;
        const { home, bgWrap } = infra;
        if (home.style.display === "none" || !home.classList.contains("active")) return;

        bgWrap.classList.add("infra-canvas-active");
        stopLoop();
        renderFrame();

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }
        if (typeof gsap === "undefined") {
            return;
        }

        infraTween = gsap.to(infraAnimation, {
            frame: INFRA_FRAME_COUNT - 1,
            snap: "frame",
            ease: "none",
            duration: INFRA_LOOP_SECONDS,
            repeat: -1,
            onUpdate: renderFrame,
        });
    }

    function scheduleStart() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => startLoop(), 80);
    }

    function boot() {
        if (isBootstrapped) return;
        isBootstrapped = true;
        preloadFrames();
        scheduleStart();
    }

    document.addEventListener("destaq:tab-change", (e) => {
        const tab = e.detail && e.detail.tab;
        if (tab === "home") scheduleStart();
        else stopLoop();
    });

    document.addEventListener("visibilitychange", () => {
        const infra = getInfraContext();
        if (!infra) return;
        const { home } = infra;
        if (home.style.display === "none" || !home.classList.contains("active")) return;
        if (document.hidden) stopLoop();
        else scheduleStart();
    });

    window.addEventListener("resize", () => {
        const infra = getInfraContext();
        if (!infra) return;
        ensureCanvasSize(infra.canvas);
        renderFrame();
        scheduleStart();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }

    window.addEventListener(
        "load",
        () => {
            scheduleStart();
        },
        { once: true }
    );
})();

// ===== COOKIE CONSENT (LGPD) =====
window.checkConsent = function() {
    try {
        const consentData = localStorage.getItem('destaq_cookie_consent');
        if (consentData) {
            const parsed = JSON.parse(consentData);
            return parsed.consent === true;
        }
    } catch(e) {
        return false;
    }
    return false;
};

document.addEventListener("DOMContentLoaded", () => {
    const banner = document.getElementById('cookie-consent');
    const btnAccept = document.getElementById('btn-cookie-accept');
    const btnEssentials = document.getElementById('btn-cookie-essentials');

    // Verifica se já respondeu
    if (!localStorage.getItem('destaq_cookie_consent')) {
        // Delay pequeno para animação de entrada ficar mais natural
        setTimeout(() => {
            if(banner) banner.classList.add('show');
        }, 1500);
    }

    function hideBanner() {
        if(banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 600); // Remove do DOM após transição
        }
    }

    if (btnAccept) {
        btnAccept.addEventListener('click', () => {
            localStorage.setItem('destaq_cookie_consent', JSON.stringify({
                consent: true,
                timestamp: new Date().toISOString(),
                version: "1.0"
            }));
            
            // Aqui inicializaria GA/Pixel
            if (window.checkConsent() && typeof initGoogleAnalytics === 'function') { 
                initGoogleAnalytics(); 
            }
            
            hideBanner();
        });
    }

    if (btnEssentials) {
        btnEssentials.addEventListener('click', () => {
            localStorage.setItem('destaq_cookie_consent', JSON.stringify({
                consent: false,
                timestamp: new Date().toISOString(),
                version: "1.0"
            }));
            
            hideBanner();
        });
    }

    // Inicializa Analytics se já houver consentimento anterior
    if (window.checkConsent() && typeof initGoogleAnalytics === 'function') {
        initGoogleAnalytics();
    }
});

// ===== GOOGLE ANALYTICS 4 TRACKING =====
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Substitua pelo ID real do GA4

function initGoogleAnalytics() {
    if (window.gtag) return; // evita duplicidade
    
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { 'anonymize_ip': true });
}

function trackEvent(name, params = {}) {
    if (!window.gtag || !window.checkConsent()) return;
    gtag('event', name, params);
}

document.addEventListener("DOMContentLoaded", () => {
    // Tracking global de botões com data-track
    document.addEventListener('click', (e) => {
        const trackEl = e.target.closest('[data-track]');
        if (trackEl) {
            const eventName = trackEl.getAttribute('data-track');
            trackEvent(eventName);
        }
    });

    // Tracking Específico para Planos de Preços
    document.querySelectorAll('.pricing-card .btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.pricing-card');
            const planName = card.querySelector('.pricing-title') ? card.querySelector('.pricing-title').innerText : 'Unknown';
            const toggle = document.getElementById('pricing-toggle');
            const isAnnual = toggle ? toggle.checked : false;
            trackEvent('plan_cta_click', { plan_name: planName, period: isAnnual ? 'anual' : 'mensal' });
        });
    });
});

// ===== B2B CTA FORM LOGIC =====
// Cliente Supabase: usa auth.js (resolve placeholders de config.js) para evitar seu_projeto / chave demo na consola
/** Cliente Supabase único: criado em auth.js (getSupabaseClient), nunca duplicar aqui. */
const sb = typeof window.DESTAQ_getSupabaseClient === 'function' ? window.DESTAQ_getSupabaseClient() : null;
if (sb) window.sb = sb;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("b2b-cta-form");
    if (!form) return;

    const emailInput = document.getElementById("b2b-email");
    const wpInput = document.getElementById("b2b-whatsapp");
    const nameInput = document.getElementById("b2b-name");
    const companyInput = document.getElementById("b2b-company");
    const segmentInput = document.getElementById("b2b-segment");
    const volumeInputs = document.querySelectorAll('input[name="volume"]');
    
    // Tracking de início de form
    let formStarted = false;
    form.addEventListener('focusin', () => {
        if (!formStarted) {
            formStarted = true;
            if (typeof trackEvent === 'function') trackEvent('demo_form_start');
        }
    });

    // Máscara para WhatsApp (BR)
    wpInput.addEventListener('input', function (e) {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });

    // Validação de E-mail Corporativo
    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'outlook.com.br', 'hotmail.com.br'];
        if (!re.test(email)) return false;
        const domain = email.split('@')[1].toLowerCase();
        return !invalidDomains.includes(domain);
    };

    const setInputState = (input, isValid) => {
        const errorMsg = input.parentElement.querySelector('.error-msg');
        if (isValid) {
            input.classList.remove('input-invalid');
            input.classList.add('input-valid');
            if(errorMsg) errorMsg.style.display = 'none';
        } else {
            input.classList.remove('input-valid');
            input.classList.add('input-invalid');
            if(errorMsg) errorMsg.style.display = 'block';
        }
    };

    // Validações em tempo real no blur/change
    emailInput.addEventListener('blur', () => setInputState(emailInput, validateEmail(emailInput.value)));
    wpInput.addEventListener('blur', () => setInputState(wpInput, wpInput.value.length >= 14));
    nameInput.addEventListener('blur', () => setInputState(nameInput, nameInput.value.trim().length > 2));
    companyInput.addEventListener('blur', () => setInputState(companyInput, companyInput.value.trim().length > 2));
    segmentInput.addEventListener('change', () => setInputState(segmentInput, segmentInput.value !== ""));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Checagem final
        const isEmailValid = validateEmail(emailInput.value);
        const isWpValid = wpInput.value.length >= 14;
        const isNameValid = nameInput.value.trim().length > 2;
        const isCompanyValid = companyInput.value.trim().length > 2;
        const isSegmentValid = segmentInput.value !== "";
        let isVolumeValid = false;
        volumeInputs.forEach(radio => { if(radio.checked) isVolumeValid = true; });

        setInputState(emailInput, isEmailValid);
        setInputState(wpInput, isWpValid);
        setInputState(nameInput, isNameValid);
        setInputState(companyInput, isCompanyValid);
        setInputState(segmentInput, isSegmentValid);
        
        const volumeError = form.querySelector('.radio-group').nextElementSibling;
        if (!isVolumeValid) {
            volumeError.style.display = 'block';
        } else {
            volumeError.style.display = 'none';
        }

        if (!isEmailValid || !isWpValid || !isNameValid || !isCompanyValid || !isSegmentValid || !isVolumeValid) {
            if (typeof trackEvent === 'function') trackEvent('demo_form_submit', { success: false });
            return; // Bloqueia submissão
        }

        // Coleta de dados
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        const submitBtn = document.getElementById("b2b-submit-btn");
        submitBtn.innerHTML = '<span class="btn-text">Enviando...</span>';
        submitBtn.style.opacity = '0.7';
        submitBtn.disabled = true;

        try {
            // Insere os dados na tabela 'leads' do Supabase
            const { data: leadData, error: leadError } = await sb
                .from('leads')
                .insert([
                    {
                        email: data.email,
                        whatsapp: data.whatsapp,
                        nome: data.name,
                        empresa: data.company,
                        segmento: data.segmento,
                        volume: data.volume
                    }
                ]);

            if (leadError) {
                throw new Error(leadError.message);
            }

            // Simulação de delay opcional removida, já aguardamos o Supabase


            if (typeof trackEvent === 'function') trackEvent('demo_form_submit', { success: true });

            // Animação de sucesso
            const successState = document.getElementById('b2b-success-state');
            
            gsap.to(form, {
                opacity: 0,
                scale: 0.9,
                duration: 0.4,
                onComplete: () => {
                    form.style.display = 'none';
                    successState.style.display = 'flex';
                    gsap.fromTo(successState, 
                        { opacity: 0, scale: 0.8 }, 
                        { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" }
                    );
                    if(typeof dispararConfetti === 'function') {
                        dispararConfetti();
                    }
                    document.dispatchEvent(new CustomEvent('destaq:form-success'));
                }
            });

        } catch (error) {
            __logErr("Erro ao enviar o lead", error);
            submitBtn.innerHTML = '<span class="btn-text">Erro! Tentar novamente</span>';
            submitBtn.style.opacity = '1';
            submitBtn.disabled = false;
        }
    });

    // ScrollTrigger para animar a entrada da seção
    gsap.from(".cta-b2b-animate", {
        scrollTrigger: {
            trigger: ".cta-b2b-section",
            start: "top 80%"
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out"
    });
});

// ===== MASCOTE DEQ B2B =====
const DEQ = {
    el: null,
    bubble: null,
    bodyEl: null,
    idleTimer: null,
    currentState: null,
    isVisible: false,

    init() {
        this.el = document.getElementById('deq-mascot');
        this.bubble = document.getElementById('deqBubble');
        this.bodyEl = document.getElementById('deqBody');
        
        if (!this.el) return;

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Animação de entrada
        if (!prefersReducedMotion) {
            gsap.from(this.el, { 
                x: 120, 
                opacity: 0, 
                duration: 0.8, 
                delay: 2, 
                ease: 'back.out(1.7)' 
            });
        }

        // Real-time Supabase Subscription
        setTimeout(() => subscribeToNewSellers(), 3000);

        this.resetIdleTimer();

        // Listeners de inatividade
        const resetEvents = ['mousemove', 'scroll', 'click'];
        resetEvents.forEach(evt => document.addEventListener(evt, () => this.resetIdleTimer(), { passive: true }));

        // CustomEvents
        document.addEventListener('destaq:stats-complete', () => this.setState('excited'));
        document.addEventListener('destaq:form-success', () => this.setState('celebrate'));
        document.addEventListener('destaq:tab-change', (e) => this.onTabChange(e.detail.tab));
        document.addEventListener('destaq:pricing-view', () => this.setState('tip', 'Plano Pro tem ROI de 3.2x em 90 dias 🏆'));
        
        this.cycleIdx = 0;
    },

    setState(state, customMsg) {
        this.currentState = state;
        const msgMap = {
            'happy': 'Tudo certo! Ecossistema crescendo. 😄',
            'thinking': 'Calculando a melhor estratégia...',
            'excited': 'UAU! Meta de GMV atingida! 🎉',
            'tip': '💡 Sellers com fotos HD vendem 3x mais!',
            'idle': 'Ei! Posso te ajudar com algo? 🐻',
            'celebrate': 'Recebemos! Em breve nossa equipe chama! 🎊',
            'greeting': 'Olá! Bem-vindo ao DestaQ. 👋'
        };

        const msg = customMsg || msgMap[state] || msgMap['idle'];
        document.getElementById('deqBubbleText').innerText = msg;
        this.bubble.classList.add('visible');

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!prefersReducedMotion && this.bodyEl) {
            // Animação base para qualquer state
            gsap.to(this.bodyEl, { scale: 1.1, duration: 0.25, yoyo: true, repeat: 1 });

            if (state === 'celebrate') {
                gsap.fromTo(this.bodyEl, { rotation: -15 }, { rotation: 15, duration: 0.2, yoyo: true, repeat: 4 });
            } else if (state === 'excited') {
                gsap.fromTo(this.bodyEl, { scale: 1 }, { scale: 1.2, duration: 0.3, yoyo: true, repeat: 2 });
            }
        }

        // Auto-dismiss após 5000ms
        clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = setTimeout(() => this.dismiss(), 5000);
    },

    onTabChange(tab) {
        const map = {
            'produtos': { state: 'tip', msg: '📦 Catálogo com novos SKUs disponíveis!' },
            'network': { state: 'happy', msg: '🤝 Sellers conectados aqui!' },
            'plataformas': { state: 'tip', msg: '💡 Plano Pro: ROI médio de 3.2x em 90 dias' },
            'comunidade': { state: 'greeting', msg: '💬 Compartilhe um case de sucesso!' }
        };
        const config = map[tab] || map['produtos'];
        this.setState(config.state, config.msg);
    },

    interact() {
        const cycle = ['happy', 'tip', 'excited'];
        this.setState(cycle[this.cycleIdx]);
        this.cycleIdx = (this.cycleIdx + 1) % cycle.length;
    },

    notifyNewSeller(company) {
        this.setState('happy', `🏪 ${company} acabou de entrar no ecossistema!`);
    },

    dismiss() {
        if(this.bubble) this.bubble.classList.remove('visible');
        clearTimeout(this.autoDismissTimer);
    },

    resetIdleTimer() {
        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.setState('idle'), 30000);
    }
};

window.DEQ = DEQ;

document.addEventListener('DOMContentLoaded', () => {
    DEQ.init();
    
    // Teste automático do PopupSystem (Animação Lateral)
    setTimeout(() => {
        PopupSystem.toast({
            icon: '🚀',
            title: 'Sistema Conectado',
            sub: 'O ecossistema DestaQ está online e operante.',
            duration: 5000
        });
    }, 2000);
});

// ===== SUPABASE REALTIME SUBSCRIPTION =====
function subscribeToNewSellers() {
    const client =
        (typeof window.DESTAQ_getSupabaseClient === 'function' && window.DESTAQ_getSupabaseClient()) ||
        (typeof window.sb !== 'undefined' ? window.sb : null) ||
        sb;
    if (!client || typeof client.channel !== 'function') return;

    // 1. Throttle: só exibe se último toast foi há mais de 10s
    const lastNotif = { time: 0 };
    
    // 2. Contador de sessão
    let newSellersCount = 0;
    
    // 3. Canal Supabase
    const channel = client.channel('new-sellers')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'profiles'
        }, (payload) => {
            const now = Date.now();
            if (now - lastNotif.time < 10000) return;
            lastNotif.time = now;
            
            const company = payload.new.company_name || 'Novo seller';
            const verified = payload.new.verified;
            
            // Atualiza mascote
            DEQ.notifyNewSeller(company + (verified ? ' ✓' : ''));
            
            // Toast
            if (typeof PopupSystem !== 'undefined') {
                PopupSystem.toast({
                    icon: '🏪',
                    title: company + ' entrou!',
                    sub: verified ? 'Seller verificado no ecossistema' : 'Novo seller no ecossistema DestaQ',
                    duration: 4000
                });
            }
            
            // Contador
            newSellersCount++;
            if (newSellersCount % 5 === 0) {
                DEQ.setState('excited', '🎉 +' + newSellersCount + ' sellers entraram hoje!');
            }
        })
        .subscribe();
        
    // 4. Guardar para possível unsubscribe
    window._sellerChannel = channel;
}

// ===== EXIT INTENT SYSTEM =====
const ExitIntent = {
  shown: false,
  pageLoadTime: Date.now(),

  init() {
    // Desktop: detecta mouse saindo pelo topo
    document.addEventListener('mouseleave', (e) => {
      if (e.clientY <= 0) this.trigger();
    });

    // Mobile: detecta visibilitychange
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.trigger();
    });

    // Mobile extra: botão voltar
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => {
      history.pushState(null, '', location.href);
      this.trigger();
    });
  },

  canShow() {
    // Guards:
    if (this.shown) return false;
    if (sessionStorage.getItem('deq_exit_shown')) return false;
    if (Date.now() - this.pageLoadTime < 30000) return false;
    // Não mostrar se usuário está digitando no formulário
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return false;
    return true;
  },

  getContent() {
    // Lógica para ler a aba ativa atual usando a estrutura existente do DestaQ
    let tab = 'default';
    const activeTab = document.querySelector('.nav-tab.active');
    
    if (activeTab && typeof tabMap !== 'undefined') {
        const targetId = activeTab.getAttribute('data-target');
        // Procura a chave correspondente no tabMap existente
        const foundTab = Object.keys(tabMap).find(key => tabMap[key].id === targetId);
        if (foundTab) tab = foundTab;
    }

    const contents = {
      'produtos':    { title:'ANTES DE IR...', body:'Quer ver o catálogo completo? São mais de 10.000 SKUs disponíveis para revenda imediata.' },
      'plataformas': { title:'ANTES DE IR...', body:'Que tal uma demo gratuita de 30 minutos? Sem scripts — uma conversa real sobre o seu negócio.' },
      'network':     { title:'ANTES DE IR...', body:'Você está a um clique de se conectar com 1.200+ sellers do ecossistema DestaQ.' },
      'default':     { title:'ANTES DE IR...', body:'Receba nosso report exclusivo "E-commerce B2B Brasil 2025" com dados de mercado.' }
    };
    return contents[tab] || contents['default'];
  },

  trigger() {
    if (!this.canShow()) return;
    this.shown = true;
    sessionStorage.setItem('deq_exit_shown', '1');

    const content = this.getContent();

    if (typeof DEQ !== 'undefined' && DEQ.setState) {
        DEQ.setState('tip', '💡 ' + content.body.substring(0, 60) + '...');
    }

    if (typeof PopupSystem !== 'undefined' && PopupSystem.modal) {
        PopupSystem.modal({
          title: content.title,
          body: content.body + ' Resposta em até 2h úteis.',
          cta: {
            label: 'Sim, quero ver →',
            fn: "document.getElementById('b2b-cta-form')?.scrollIntoView({behavior:'smooth'}); PopupSystem.closeModal()"
          }
        });
    }
  }
};

// Inicializar:
document.addEventListener('DOMContentLoaded', () => ExitIntent.init());

// ===== ADVANCED INTERACTIONS (CURSOR & CARDS) =====
function initAdvancedInteractions() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return; // Disable on touch devices
    if (reducedMotion) return; // Accessibility compliance

    // 1. Setup Elements
    const dot = document.createElement('div');
    dot.id = 'cursor-dot';
    const ring = document.createElement('div');
    ring.id = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('custom-cursor');

    const setCursorPos = (el, x, y) => {
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    // 2. Mouse Tracking (Lerp for ring)
    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.opacity = '1';
        setCursorPos(dot, mx, my);
    });

    const renderRing = () => {
        rx += (mx - rx) * 0.12;
        ry += (my - ry) * 0.12;
        setCursorPos(ring, rx, ry);
        requestAnimationFrame(renderRing);
    };
    requestAnimationFrame(renderRing);

    // 3. Hover States (Links & Buttons)
    document.querySelectorAll('a, button, .btn, .nav-tab').forEach(el => {
        el.addEventListener('mouseenter', () => {
            ring.style.width = '48px';
            ring.style.height = '48px';
            ring.style.borderColor = 'rgba(240, 192, 64, 0.8)';
        });
        el.addEventListener('mouseleave', () => {
            ring.style.width = '32px';
            ring.style.height = '32px';
            ring.style.borderColor = 'rgba(139, 92, 246, 0.6)';
        });
    });

    // 4. Hover States, Tilt 3D & Glow (Cards)
    const cards = document.querySelectorAll('.catalog-card, .pricing-card, .post-card, .network-col');
    cards.forEach(card => {
        // Cursor scale
        card.addEventListener('mouseenter', () => {
            ring.style.width = '64px';
            ring.style.height = '64px';
            ring.style.opacity = '0.6';
        });
        card.addEventListener('mouseleave', () => {
            ring.style.width = '32px';
            ring.style.height = '32px';
            ring.style.opacity = '1';
        });

        // 3D Tilt & Mouse Tracking Glow
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            // Glow Update
            card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
            card.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
            
            // 3D Tilt Update
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            if (typeof gsap !== 'undefined') {
                gsap.to(card, { rotationY: x * 8, rotationX: -y * 8, duration: 0.4, ease: 'power2.out', transformPerspective: 800 });
            }
        });

        // Reset Tilt
        card.addEventListener('mouseleave', () => {
            if (typeof gsap !== 'undefined') {
                gsap.to(card, { rotationY: 0, rotationX: 0, duration: 0.5, ease: 'power2.out' });
            }
        });
    });

    // 5. Click feedback (sem GSAP no dot — evita sobrescrever o transform de posição).
    document.addEventListener('mousedown', () => {
        const x = mx;
        const y = my;
        dot.style.transition = 'transform 0.08s ease';
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(1.35)`;
        setTimeout(() => {
            dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%) scale(1)`;
            dot.style.transition = 'opacity 0.2s';
        }, 90);
    });
}

document.addEventListener('DOMContentLoaded', () => initAdvancedInteractions());

// ===== SOBRE DESTAQ (micro animações premium) =====
function initSobreSectionMotion() {
    const sobre = document.querySelector('.sobre-destaq-section');
    if (!sobre) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    const texto = sobre.querySelector('.sobre-texto');
    const visual = sobre.querySelector('.sobre-visual');
    const diferenciais = sobre.querySelectorAll('.diferencial-item');
    const nichos = sobre.querySelectorAll('.nicho-tag');

    if (texto && visual) {
        gsap.from(texto.children, {
            y: 24,
            opacity: 0,
            duration: 0.65,
            ease: 'power2.out',
            stagger: 0.08,
            scrollTrigger: {
                trigger: sobre,
                start: 'top 78%',
                once: true
            }
        });

        gsap.from(visual, {
            x: 30,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: sobre,
                start: 'top 75%',
                once: true
            }
        });
    }

    if (diferenciais.length) {
        gsap.from(diferenciais, {
            y: 14,
            opacity: 0,
            duration: 0.5,
            ease: 'power1.out',
            stagger: 0.12,
            scrollTrigger: {
                trigger: sobre.querySelector('.sobre-diferenciais') || sobre,
                start: 'top 82%',
                once: true
            }
        });
    }

    if (nichos.length) {
        gsap.from(nichos, {
            scale: 0.92,
            opacity: 0,
            duration: 0.35,
            ease: 'back.out(1.8)',
            stagger: 0.04,
            scrollTrigger: {
                trigger: sobre.querySelector('.sobre-nichos-tags') || sobre,
                start: 'top 88%',
                once: true
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => initSobreSectionMotion());

// ===== OWL TAB ANIMATION =====
(function initOwlTabAnimation() {
    // Título base inicial
    window.siteBaseTitle = document.title || "DestaQ | Ecossistema B2B";
    
    // Frames da coruja
    const owlFrames = [
        "(o_o) ",
        "(O_O) ",
        "(-_-) ",
        "(O_O) ",
        "(o_O) ",
        "(O_o) "
    ];
    let frame = 0;
    
    setInterval(() => {
        document.title = owlFrames[frame] + window.siteBaseTitle;
        frame = (frame + 1) % owlFrames.length;
    }, 1200);
})();

// ===== POPUP SYSTEM =====
const PopupSystem = {
    queue: [],
    active: false,

    modal(opts) {
        const overlay = document.createElement('div');
        overlay.className = 'deq-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'deq-modal';
        
        let html = '';
        if (opts.title) html += `<h3>${opts.title}</h3>`;
        if (opts.body) html += `<p>${opts.body}</p>`;
        if (opts.cta) html += `<button class="deq-modal-cta">${opts.cta.label}</button>`;
        
        html += `<button class="deq-modal-close" aria-label="Fechar">×</button>`;
        modal.innerHTML = html;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeBtn = modal.querySelector('.deq-modal-close');
        const ctaBtn = modal.querySelector('.deq-modal-cta');
        
        const closeFn = () => this.closeModal(overlay, modal);
        
        closeBtn.addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeFn();
        });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeFn();
                document.removeEventListener('keydown', escHandler);
            }
        });
        
        if (ctaBtn && opts.cta.fn) {
            ctaBtn.addEventListener('click', () => {
                opts.cta.fn();
                closeFn();
            });
        }

        gsap.fromTo(modal, 
            { scale: 0.85, opacity: 0, filter: 'blur(8px)' },
            { scale: 1, opacity: 1, filter: 'blur(0px)', ease: 'back.out(1.4)', duration: 0.45 }
        );
    },

    closeModal(overlay, modal) {
        gsap.to(modal, {
            scale: 0.9, opacity: 0, duration: 0.25,
            onComplete: () => {
                if (overlay.parentNode) overlay.remove();
            }
        });
    },

    toast(opts) {
        this.queue.push(opts);
        if (!this.active) this._next();
    },

    _next() {
        if (!this.queue.length) { 
            this.active = false; 
            return; 
        }
        this.active = true;
        const opts = this.queue.shift();
        
        const toast = document.createElement('div');
        toast.className = 'deq-toast';
        toast.innerHTML = `
            <div class="deq-toast-icon">${opts.icon || '🔔'}</div>
            <div class="deq-toast-content">
                <div class="deq-toast-title">${opts.title}</div>
                ${opts.sub ? `<div class="deq-toast-sub">${opts.sub}</div>` : ''}
            </div>
        `;
        document.body.appendChild(toast);

        gsap.fromTo(toast,
            { x: 120 },
            { x: 0, ease: 'back.out(1.5)', duration: 0.4 }
        );

        setTimeout(() => {
            gsap.to(toast, {
                x: 120, duration: 0.3,
                onComplete: () => {
                    toast.remove();
                    this._next();
                }
            });
        }, opts.duration || 3500);
    },

    inline(selector, msg, type) {
        const target = document.querySelector(selector);
        if (!target) return;
        
        const inlineMsg = document.createElement('div');
        inlineMsg.className = `deq-inline deq-inline-${type}`;
        inlineMsg.innerText = msg;
        
        target.parentNode.insertBefore(inlineMsg, target.nextSibling);
        
        gsap.fromTo(inlineMsg,
            { opacity: 0, y: -5 },
            { opacity: 1, y: 0, duration: 0.2 }
        );
        
        setTimeout(() => {
            gsap.to(inlineMsg, {
                opacity: 0, y: -5, duration: 0.2,
                onComplete: () => inlineMsg.remove()
            });
        }, 4000);
    }
};

// ===== TOAST AUTOMÁTICO (Social Proof) =====
setTimeout(() => {
    PopupSystem.toast({
        icon: '🔔',
        title: 'Novo vendedor cadastrado em Plataformas',
        sub: 'há 2 minutos • São Paulo, SP'
    });
}, 5000);

setTimeout(() => {
    PopupSystem.toast({
        icon: '🐻',
        title: 'DeQ: +34 sellers entraram esta semana!',
        sub: 'Ecossistema DestaQ'
    });
}, 12000);

// ===== PRODUCT MARKETPLACE (Alibaba-like, sem preço público) =====
const PRODUCT_CONFIG = {
    cacheMs: Math.max(60 * 1000, Number(window.DESTAQ_CONFIG?.PRODUCT?.UI_CACHE_MINUTES || 5) * 60 * 1000),
    imageBucket: window.DESTAQ_CONFIG?.PRODUCT?.INQUIRY_IMAGE_BUCKET || 'product-inquiry-images',
    showEntryModalEverySession: window.DESTAQ_CONFIG?.PRODUCT?.SHOW_ENTRY_MODAL_EVERY_SESSION !== false
};

const productState = {
    categories: [],
    products: [],
    activeCategorySlug: 'all',
    loadedAt: 0,
    selectedSeller: null,
    fallbackMode: false,
    topRssProducts: []
};

const fallbackProductCategories = [
    { id: 'acessorios-veiculos', slug: 'acessorios-veiculos', name: 'Acessórios para Veículos', display_order: 1 },
    { id: 'pet-shop', slug: 'pet-shop', name: 'Pet Shop', display_order: 2 },
    { id: 'arte-papelaria-armarinho', slug: 'arte-papelaria-armarinho', name: 'Arte, Papelaria e Armarinho', display_order: 3 },
    { id: 'bebes', slug: 'bebes', name: 'Bebês', display_order: 4 },
    { id: 'beleza-cuidado-pessoal', slug: 'beleza-cuidado-pessoal', name: 'Beleza e Cuidado Pessoal', display_order: 5 },
    { id: 'brinquedos-hobbies', slug: 'brinquedos-hobbies', name: 'Brinquedos e Hobbies', display_order: 6 },
    { id: 'calcados-roupas-bolsas', slug: 'calcados-roupas-bolsas', name: 'Calçados, Roupas e Bolsas', display_order: 7 },
    { id: 'cameras-acessorios', slug: 'cameras-acessorios', name: 'Câmeras e Acessórios', display_order: 8 },
    { id: 'casa-moveis-decoracao', slug: 'casa-moveis-decoracao', name: 'Casa, Móveis e Decoração', display_order: 9 },
    { id: 'celulares-telefones', slug: 'celulares-telefones', name: 'Celulares e Telefones', display_order: 10 },
    { id: 'acessorios-celulares', slug: 'acessorios-celulares', name: 'Acessórios para Celulares', display_order: 11 },
    { id: 'eletrodomesticos', slug: 'eletrodomesticos', name: 'Eletrodomésticos', display_order: 12 },
    { id: 'eletronicos-audio-video', slug: 'eletronicos-audio-video', name: 'Eletrônicos, Áudio e Vídeo', display_order: 13 },
    { id: 'esportes-fitness', slug: 'esportes-fitness', name: 'Esportes e Fitness', display_order: 14 },
    { id: 'ferramentas', slug: 'ferramentas', name: 'Ferramentas', display_order: 15 },
    { id: 'festas-lembrancinhas', slug: 'festas-lembrancinhas', name: 'Festas e Lembrancinhas', display_order: 16 },
    { id: 'informatica', slug: 'informatica', name: 'Informática', display_order: 17 }
];

const fallbackProducts = [
    { id: 'fb-1', category_slug: 'celulares-telefones', name: 'Smartphone 5G', image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80', badge_text: 'Alta procura', min_order_qty: 50, is_featured: true },
    { id: 'fb-2', category_slug: 'eletronicos-audio-video', name: 'Drones 4K', image_url: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=80', badge_text: 'Lançamento', min_order_qty: 15, is_featured: true },
    { id: 'fb-3', category_slug: 'acessorios-veiculos', name: 'Acessórios automotivos premium', image_url: 'https://images.unsplash.com/photo-1486496572940-2bb2341fdbdf?w=800&q=80', badge_text: 'Em alta', min_order_qty: 20, is_featured: true },
    { id: 'fb-4', category_slug: 'calcados-roupas-bolsas', name: 'Moletons streetwear', image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80', badge_text: 'Coleção', min_order_qty: 80, is_featured: false },
    { id: 'fb-5', category_slug: 'cameras-acessorios', name: 'Câmera mirrorless', image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80', badge_text: 'Criadores', min_order_qty: 12, is_featured: false },
    { id: 'fb-6', category_slug: 'arte-papelaria-armarinho', name: 'Kit papelaria criativa', image_url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80', badge_text: 'Papelaria', min_order_qty: 100, is_featured: false }
];

const PRODUCT_CATEGORY_IMAGE_HINTS = {
    'acessorios-veiculos': 'https://images.unsplash.com/photo-1486496572940-2bb2341fdbdf?w=800&q=80',
    'pet-shop': 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80',
    'arte-papelaria-armarinho': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80',
    'bebes': 'https://images.unsplash.com/photo-1544126592-807ade215a0b?w=800&q=80',
    'beleza-cuidado-pessoal': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
    'brinquedos-hobbies': 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&q=80',
    'calcados-roupas-bolsas': 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80',
    'cameras-acessorios': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
    'casa-moveis-decoracao': 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',
    'celulares-telefones': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
    'acessorios-celulares': 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&q=80',
    'eletrodomesticos': 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&q=80',
    'eletronicos-audio-video': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80',
    'esportes-fitness': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
    'ferramentas': 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80',
    'festas-lembrancinhas': 'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=800&q=80',
    'informatica': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80'
};

function productClient() {
    if (typeof window.DESTAQ_getSupabaseClient === 'function') {
        const c = window.DESTAQ_getSupabaseClient();
        if (c) return c;
    }
    if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;
    if (typeof window !== 'undefined' && window.sb) return window.sb;
    return typeof sb !== 'undefined' ? sb : null;
}

function productEscape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
}

function productNotify(type, title, sub) {
    if (typeof PopupSystem !== 'undefined' && PopupSystem.toast) {
        PopupSystem.toast({ icon: type === 'error' ? '⚠️' : '🔔', title, sub });
        return;
    }
    if (import.meta.env.DEV) console.log(`[Produto][${type}] ${title}`, sub || '');
}

function productMapPhoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
}

function productBuildWhatsappUrl(phoneDigits, payload) {
    const text = [
      'Olá! Quero solicitar cotação B2B.',
      `Produto: ${payload.requested_product_name}`,
      `Quantidade mínima: ${payload.min_quantity}`,
      `Nome: ${payload.customer_name}`,
      `Telefone: ${payload.customer_phone}`,
      payload.reference_image_url ? `Imagem referência: ${payload.reference_image_url}` : null
    ].filter(Boolean).join('\n');
    return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}

function productCategoryById(id) {
    return productState.categories.find((c) => c.id === id) || null;
}

function productNormalizedItems() {
    return productState.products.map((p) => ({
        ...p,
        category_slug: p.category_slug || productCategoryById(p.category_id)?.slug || 'all'
    }));
}

function renderProductHighlights(items) {
    const host = document.getElementById('product-highlight-grid');
    if (!host) return;
    const categories = productState.categories.slice(0, 40);
    if (!categories.length) {
        host.innerHTML = '<p class="product-loading">Sem categorias disponíveis no momento.</p>';
        return;
    }

    const imageByCategory = new Map();
    items.forEach((p) => {
        const slug = p.category_slug || '';
        if (!slug || imageByCategory.has(slug)) return;
        imageByCategory.set(slug, p.image_url || '');
    });

    host.innerHTML = categories.map((c) => {
      const img = PRODUCT_CATEGORY_IMAGE_HINTS[c.slug] || imageByCategory.get(c.slug) || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80';
      return `
      <button type="button" class="product-highlight-card" onclick="window.openProductRequestModal && window.openProductRequestModal('${productEscape(c.name)}')">
        <div class="product-highlight-image-wrap">
          <img src="${productEscape(img)}" alt="${productEscape(c.name)}" loading="lazy">
        </div>
        <span>${productEscape(c.name)}</span>
      </button>
    `;
    }).join('');
}

function productNormalizeText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
}

async function productFetchTop3FromRss(items) {
    const fallback = items
      .filter((p) => p.is_featured)
      .slice(0, 3)
      .map((p, i) => ({ rank: i + 1, name: p.name, image_url: p.image_url, hits: 1, source: 'Base catálogo' }));
    if (!items.length) return fallback;

    const candidates = items.slice(0, 40).map((p) => ({
      name: p.name,
      image_url: p.image_url,
      source: '',
      hits: 0,
      match: productNormalizeText(p.name)
    }));

    const synonyms = {
      smartphone: ['smartphone', 'celular', 'telefone'],
      drone: ['drone', 'aereo'],
      acessorios: ['acessorio', 'acessorios', 'suporte', 'cabo', 'carregador'],
      camera: ['camera', 'fotografia'],
      roupas: ['roupa', 'vestido', 'calcado', 'bolsa'],
      esportes: ['esporte', 'fitness'],
      beleza: ['beleza', 'cosmetico', 'cuidado pessoal'],
      pet: ['pet', 'cachorro', 'gato'],
      informatica: ['informatica', 'notebook', 'computador'],
      ferramentas: ['ferramenta', 'hardware']
    };

    try {
      const signalRows = await fetchMarketplaceSignalsFromSupabase();
      signalRows.forEach((r) => {
        const t = productNormalizeText(`${r.title || ''} ${r.summary || ''}`);
        candidates.forEach((c) => {
          if (!c.match || c.match.length < 4) return;
          const directHit = t.includes(c.match);
          const synHit = Object.values(synonyms).some((arr) => {
            const anyInName = arr.some((token) => c.match.includes(token));
            return anyInName && arr.some((token) => t.includes(token));
          });
          if (directHit || synHit) {
            c.hits += 1;
            if (!c.source) c.source = r.source || 'Pipeline Supabase';
          }
        });
      });
    } catch (err) {
      __logWarn('[Produto] sinais de marketplace indisponíveis, usando fallback do catálogo.', err);
    }

    const top = candidates
      .filter((c) => c.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map((c, i) => ({ rank: i + 1, name: c.name, image_url: c.image_url, hits: c.hits, source: c.source || 'Pipeline Supabase' }));

    return top.length ? top : fallback;
}

function renderProductRssTop3(rows) {
    const grid = document.getElementById('product-rss-top3-grid');
    if (!grid) return;

    if (!rows.length) {
        grid.innerHTML = '<p class="product-loading">Sem dados de tendência no RSS no momento.</p>';
        return;
    }

    grid.innerHTML = rows.map((r) => `
      <article class="product-rss-card glass-panel">
        <div class="product-rss-rank">#${r.rank}</div>
        <div class="product-rss-image">
          <img src="${productEscape(r.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80')}" alt="${productEscape(r.name)}" loading="lazy">
        </div>
        <div class="product-rss-info">
          <h4>${productEscape(r.name)}</h4>
          <p>${productEscape(r.source || 'RSS marketplace')} • ${Number(r.hits || 1)} menções recentes</p>
          <button type="button" class="btn-details" onclick="window.openProductRequestModal && window.openProductRequestModal('${productEscape(r.name)}')">
            Quero este produto
          </button>
        </div>
      </article>
    `).join('');
}

function productBuildRequestModalHtml(prefillProductName = '') {
    return `
      <div class="product-request-overlay" id="product-request-modal" role="dialog" aria-modal="true" aria-label="Solicitar produto">
        <div class="product-request-modal">
          <button type="button" class="product-request-close" id="product-request-close" aria-label="Fechar">×</button>
          <h3>O que você procura?</h3>
          <p>Informe seu produto e receba atendimento imediato com uma de nossas vendedoras.</p>
          <form id="product-request-form" class="product-request-form">
            <label>Produto desejado</label>
            <input type="text" id="product-request-name" value="${productEscape(prefillProductName)}" placeholder="Ex.: Smartphone 5G, drone, vestido..." maxlength="120" required>

            <label>Imagem de referência (fundo branco)</label>
            <input type="file" id="product-request-image" accept="image/png,image/jpeg,image/webp">
            <div class="product-request-image-preview" id="product-request-image-preview">Pré-visualização</div>

            <label>Seu nome</label>
            <input type="text" id="product-customer-name" placeholder="Nome completo" maxlength="90" required>

            <label>Seu WhatsApp</label>
            <input type="tel" id="product-customer-phone" placeholder="(11) 99999-9999" maxlength="20" required>

            <label>Quantidade mínima</label>
            <input type="number" id="product-min-qty" min="1" step="1" value="1" required>

            <button type="submit" id="product-request-submit" class="product-request-submit">Buscar fornecedora</button>
          </form>
        </div>
      </div>
    `;
}

async function productUploadInquiryImage(file) {
    if (!file) return null;
    const client = productClient();
    if (!client?.storage) return null;
    const safeName = `${Date.now()}-${String(file.name || 'ref').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path = `public/${safeName}`;
    const { error: uploadError } = await client.storage.from(PRODUCT_CONFIG.imageBucket).upload(path, file, {
        upsert: false,
        contentType: file.type || 'image/jpeg'
    });
    if (uploadError) throw uploadError;
    const { data } = client.storage.from(PRODUCT_CONFIG.imageBucket).getPublicUrl(path);
    return data?.publicUrl || null;
}

async function productFetchRandomSeller() {
    const client = productClient();
    if (!client) return null;
    const { data, error } = await client.rpc('get_random_active_seller');
    if (error) throw error;
    if (!data) return null;
    if (Array.isArray(data)) return data[0] || null;
    return data;
}

function renderProductSellerResult(lead, seller, waUrl) {
    const modal = document.getElementById('product-request-modal');
    if (!modal) return;
    const phoneDigits = productMapPhoneDigits(seller?.whatsapp_number || '');
    const qrUrl = seller?.qr_image_url || 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?w=400&q=80';
    modal.querySelector('.product-request-modal').innerHTML = `
      <button type="button" class="product-request-close" id="product-request-close" aria-label="Fechar">×</button>
      <h3>Solicitação enviada com sucesso</h3>
      <p>Atendimento direcionado para <strong>${productEscape(seller?.seller_name || 'Equipe Destaq')}</strong>.</p>
      <div class="product-seller-result">
        <img src="${productEscape(qrUrl)}" alt="QR code WhatsApp da vendedora" loading="lazy">
        <div>
          <p><strong>Produto:</strong> ${productEscape(lead.requested_product_name)}</p>
          <p><strong>MOQ:</strong> ${productEscape(String(lead.min_quantity))}</p>
          <p><strong>WhatsApp:</strong> ${productEscape(phoneDigits || 'N/D')}</p>
        </div>
      </div>
      <a class="product-whatsapp-btn" href="${productEscape(waUrl)}" target="_blank" rel="noopener noreferrer">
        Abrir WhatsApp da vendedora
      </a>
    `;
    modal.querySelector('#product-request-close')?.addEventListener('click', () => modal.remove());
}

window.openProductRequestModal = function(prefillProductName = '') {
    const existing = document.getElementById('product-request-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', productBuildRequestModalHtml(prefillProductName));

    const modal = document.getElementById('product-request-modal');
    const closeBtn = document.getElementById('product-request-close');
    const form = document.getElementById('product-request-form');
    const imageInput = document.getElementById('product-request-image');
    const imagePreview = document.getElementById('product-request-image-preview');
    const phoneInput = document.getElementById('product-customer-phone');

    const close = () => modal?.remove();
    closeBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (ev) => {
        if (ev.target === modal) close();
    });

    phoneInput?.addEventListener('input', function (e) {
        const raw = String(e.target.value || '').replace(/\D/g, '').slice(0, 11);
        const p1 = raw.slice(0, 2);
        const p2 = raw.slice(2, 7);
        const p3 = raw.slice(7, 11);
        e.target.value = !p2 ? p1 : `(${p1}) ${p2}${p3 ? `-${p3}` : ''}`;
    });

    imageInput?.addEventListener('change', () => {
        const file = imageInput.files?.[0];
        if (!file || !imagePreview) {
            if (imagePreview) imagePreview.textContent = 'Pré-visualização';
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            productNotify('error', 'Imagem acima de 8 MB.');
            imageInput.value = '';
            imagePreview.textContent = 'Pré-visualização';
            return;
        }
        const local = URL.createObjectURL(file);
        imagePreview.innerHTML = `<img src="${local}" alt="Prévia da imagem enviada">`;
    });

    form?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const submit = document.getElementById('product-request-submit');
        const requestedProductName = (document.getElementById('product-request-name')?.value || '').trim();
        const customerName = (document.getElementById('product-customer-name')?.value || '').trim();
        const customerPhone = (document.getElementById('product-customer-phone')?.value || '').trim();
        const minQty = Number(document.getElementById('product-min-qty')?.value || 0);
        const imageFile = imageInput?.files?.[0] || null;

        if (requestedProductName.length < 2 || customerName.length < 2) {
            productNotify('error', 'Preencha produto e nome corretamente.');
            return;
        }
        if (productMapPhoneDigits(customerPhone).length < 10) {
            productNotify('error', 'Informe um WhatsApp válido.');
            return;
        }
        if (!Number.isFinite(minQty) || minQty < 1) {
            productNotify('error', 'Quantidade mínima precisa ser maior que zero.');
            return;
        }

        if (submit) {
            submit.disabled = true;
            submit.textContent = 'Enviando...';
        }

        try {
            let referenceImageUrl = null;
            try {
                referenceImageUrl = await productUploadInquiryImage(imageFile);
            } catch (uploadErr) {
                __logWarn('[Produto] upload de referência falhou, seguindo sem imagem', uploadErr);
            }

            const seller = await productFetchRandomSeller();
            if (!seller?.id) {
                productNotify('error', 'No momento estamos sem vendedoras ativas.');
                if (submit) {
                    submit.disabled = false;
                    submit.textContent = 'Buscar fornecedora';
                }
                return;
            }

            const lead = {
                customer_name: customerName,
                customer_phone: customerPhone,
                requested_product_name: requestedProductName,
                min_quantity: minQty,
                reference_image_url: referenceImageUrl,
                selected_seller_id: seller.id,
                selected_seller_name: seller.seller_name
            };

            const client = productClient();
            const { error: inquiryError } = await client
              .from('product_inquiries')
              .insert(lead);
            if (inquiryError) throw inquiryError;

            const waUrl = productBuildWhatsappUrl(productMapPhoneDigits(seller.whatsapp_number), lead);
            renderProductSellerResult(lead, seller, waUrl);
            sessionStorage.setItem('product_request_modal_seen', '1');
            productNotify('success', 'Solicitação enviada.', 'QR e WhatsApp prontos para atendimento.');
        } catch (err) {
            __logErr('[Produto] erro no envio de solicitação:', err);
            productNotify('error', 'Não foi possível enviar agora.', 'Tente novamente em instantes.');
            if (submit) {
                submit.disabled = false;
                submit.textContent = 'Buscar fornecedora';
            }
        }
    });
};

function maybeOpenProductEntryModal() {
    if (!PRODUCT_CONFIG.showEntryModalEverySession) {
        if (sessionStorage.getItem('product_request_modal_seen') === '1') return;
    } else if (sessionStorage.getItem('product_request_modal_seen') === '1') {
        return;
    }
    if (!document.getElementById('aba-produtos')?.classList.contains('active')) return;
    window.openProductRequestModal();
}

async function loadProductMarketplace(force = false) {
    const now = Date.now();
    if (!force && productState.loadedAt && (now - productState.loadedAt) < PRODUCT_CONFIG.cacheMs && productState.products.length) {
        renderProductHighlights(productNormalizedItems());
        renderProductRssTop3(productState.topRssProducts || []);
        maybeOpenProductEntryModal();
        return;
    }

    const catHost = document.getElementById('product-highlight-grid');
    const rssHost = document.getElementById('product-rss-top3-grid');
    if (catHost) catHost.innerHTML = '<p class="product-loading">Carregando categorias...</p>';
    if (rssHost) rssHost.innerHTML = '<p class="product-loading">Carregando top 3 do RSS...</p>';

    const client = productClient();
    if (!client) {
        productState.categories = fallbackProductCategories.slice(1);
        productState.products = fallbackProducts;
        productState.fallbackMode = true;
        productState.topRssProducts = await productFetchTop3FromRss(productNormalizedItems());
        productState.loadedAt = now;
        renderProductHighlights(productNormalizedItems());
        renderProductRssTop3(productState.topRssProducts);
        maybeOpenProductEntryModal();
        return;
    }

    try {
        const [{ data: categories, error: catErr }, { data: products, error: prodErr }] = await Promise.all([
            client
              .from('product_categories')
              .select('id,slug,name,display_order')
              .eq('is_active', true)
              .order('display_order', { ascending: true }),
            client
              .from('product_catalog')
              .select('id,category_id,name,slug,image_url,badge_text,min_order_qty,is_featured')
              .eq('is_active', true)
              .order('is_featured', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(300)
        ]);

        if (catErr) throw catErr;
        if (prodErr) throw prodErr;

        if (!Array.isArray(categories) || !categories.length || !Array.isArray(products) || !products.length) {
            productState.categories = fallbackProductCategories.slice(1);
            productState.products = fallbackProducts;
            productState.fallbackMode = true;
        } else {
            productState.categories = categories;
            productState.products = products;
            productState.fallbackMode = false;
        }
    } catch (err) {
        __logErr('[Produto] fallback do catálogo devido a erro:', err);
        productState.categories = fallbackProductCategories.slice(1);
        productState.products = fallbackProducts;
        productState.fallbackMode = true;
    }

    productState.topRssProducts = await productFetchTop3FromRss(productNormalizedItems());
    productState.loadedAt = now;
    renderProductHighlights(productNormalizedItems());
    renderProductRssTop3(productState.topRssProducts);
    maybeOpenProductEntryModal();
}

// ===== SUPABASE INTEGRATION (Network & Community) =====
// Usa o client `sb` já inicializado na linha 1220

// Carregar Dados ao Iniciar
document.addEventListener('DOMContentLoaded', () => {
    if (sb) {
        initCommunityTab();
        loadTopSellers();
    }
});

/** Feed Network (LinkedIn-style) — implementação em network.js */
async function loadNetworkFeed() {
    const host = document.getElementById('network-content');
    if (typeof window.renderNetworkTab !== 'function') {
        if (host) {
            host.innerHTML = '<p style="padding:2rem;color:#b91c1c;font-family:system-ui">Erro: network.js não expôs renderNetworkTab. Confirme que o script network.js carrega sem erros (F12 → Consola).</p>';
        }
        console.error('[Network] window.renderNetworkTab não está definido.');
        return;
    }
    try {
        await window.renderNetworkTab();
        setTimeout(() => {
            if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        }, 80);
    } catch (e) {
        __logErr('[Network] loadNetworkFeed:', e);
        if (host) {
            host.innerHTML = `<p style="padding:2rem;color:#b91c1c;font-family:system-ui">Erro ao carregar o Network: ${String(e?.message || e)}</p>`;
        }
    }
}

async function loadTopSellers() {
    const list = document.getElementById('top-sellers-list');
    if (!list || !sb) return;

    try {
        const { data: sellers, error } = await sb
            .from('profiles')
            .select('*')
            .eq('role', 'seller')
            .order('followers_count', { ascending: false })
            .limit(5);

        if (error) throw error;

        list.innerHTML = '';
        sellers.forEach((seller, idx) => {
            const item = document.createElement('div');
            item.className = 'list-item fade-in';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '12px';
            item.style.marginBottom = '16px';
            
            item.innerHTML = `
                <div class="avatar" style="background: var(--secondary-dark); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                    ${seller.avatar_url ? `<img src="${seller.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : seller.display_name[0]}
                </div>
                <div class="item-info" style="flex: 1;">
                    <h4 style="margin:0; font-size: 0.95rem;">${seller.display_name} ${seller.verified ? '✅' : ''}</h4>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${seller.niche ? seller.niche[0] : 'Seller'}</span>
                </div>
                <div class="badge" style="background: var(--secondary-dark); padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: bold;">#${idx+1}</div>
            `;
            list.appendChild(item);
        });
    } catch (err) {
        __logErr("Erro Top Sellers:", err);
    }
}

const COMMUNITY_CONFIG = {
  CACHE_DURATION: Math.max(
    60 * 1000,
    Number(window.DESTAQ_CONFIG?.COMMUNITY?.UI_CACHE_MINUTES || 5) * 60 * 1000
  ),
  COMMUNITY_BACKEND_SOURCE: window.DESTAQ_CONFIG?.COMMUNITY?.BACKEND_SOURCE || 'supabase',
  COMMUNITY_RSS_FALLBACK_ENABLED: false,
  COMMUNITY_MAX_AGE_MINUTES: Number(window.DESTAQ_CONFIG?.COMMUNITY?.MAX_AGE_MINUTES || 30),
};

const FALLBACK_NEWS = [
  {
    id: 'f1',
    title: 'E-commerce brasileiro cresce 9,4% e atinge R$ 204 bilhões em 2024',
    summary: 'O setor de comércio eletrônico brasileiro registrou crescimento expressivo em 2024, impulsionado pela expansão do mobile commerce e das categorias de moda e beleza.',
    url: 'https://ecommercebrasil.com.br',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80',
    source: 'E-Commerce Brasil',
    category: 'mercado',
    published_at: new Date().toISOString(),
    is_featured: false
  },
  {
    id: 'f2',
    title: 'TikTok Shop chega ao Brasil: o que muda para os sellers?',
    summary: 'A chegada do social commerce da ByteDance ao mercado brasileiro promete transformar a forma como os lojistas vendem nas redes sociais.',
    url: 'https://ecommercebrasil.com.br',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80',
    source: 'E-Commerce Brasil',
    category: 'plataformas',
    published_at: new Date().toISOString(),
    is_featured: false
  },
  {
    id: 'f3',
    title: 'Inteligência artificial no e-commerce: da busca ao pós-venda',
    summary: 'Ferramentas de IA estão revolucionando toda a jornada de compra online, desde a recomendação de produtos até o atendimento automatizado no SAC.',
    url: 'https://ecommercebrasil.com.br',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&q=80',
    source: 'E-Commerce Brasil',
    category: 'tecnologia',
    published_at: new Date().toISOString(),
    is_featured: false
  },
  {
    id: 'f4',
    title: 'Marketplace ou loja própria? Como escolher em 2025',
    summary: 'Especialistas debatem quando vale a pena focar no marketplace e quando construir canal próprio — e como equilibrar os dois para maximizar margem.',
    url: 'https://ecommercebrasil.com.br',
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&q=80',
    source: 'E-Commerce Brasil',
    category: 'estrategia',
    published_at: new Date().toISOString(),
    is_featured: false
  },
  {
    id: 'f5',
    title: 'Frete grátis: estratégia ou armadilha para o lojista?',
    summary: 'Oferecer frete grátis pode aumentar conversão em até 30%, mas exige cálculo cuidadoso de margem e ticket médio para não comer o lucro da operação.',
    url: 'https://ecommercebrasil.com.br',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80',
    source: 'E-Commerce Brasil',
    category: 'logistica',
    published_at: new Date().toISOString(),
    is_featured: false
  }
];

const newsCache = { data: null, timestamp: 0 };
let communityUsingFallback = false;
let communityDataSource = 'fallback';
let communityLastIngestedAt = null;
let communityStaleWarning = '';

function getCommunityClient() {
  if (typeof window.DESTAQ_getSupabaseClient === 'function') {
    const c = window.DESTAQ_getSupabaseClient();
    if (c) return c;
  }
  if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;
  if (typeof window !== 'undefined' && window.sb) return window.sb;
  return typeof sb !== 'undefined' ? sb : null;
}

function formatUpdatedAtLabel(iso) {
  if (!iso) return 'Atualização indisponível';
  try {
    const dt = new Date(iso);
    return `Atualizado em ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (_) {
    return 'Atualização indisponível';
  }
}

function evaluateCommunityFreshness(lastIngestedAt) {
  if (!lastIngestedAt) return 'Sem telemetria de atualização recente.';
  const maxAgeMs = Math.max(5, COMMUNITY_CONFIG.COMMUNITY_MAX_AGE_MINUTES) * 60 * 1000;
  const ageMs = Date.now() - new Date(lastIngestedAt).getTime();
  if (Number.isNaN(ageMs) || ageMs <= maxAgeMs) return '';
  const ageMin = Math.max(1, Math.round(ageMs / 60000));
  return `Conteúdo pode estar desatualizado (${ageMin} min sem ingestão nova).`;
}

function mapCommunityDbRows(rows) {
  return (rows || []).map((row) => ({
    id: row.id || row.url_hash || btoa(String(row.url || row.title || Date.now())).slice(0, 16),
    title: row.title,
    summary: row.summary || '',
    url: row.url,
    image: row.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80',
    source: row.source || 'Fonte',
    category: row.category || 'mercado',
    tags: Array.isArray(row.tags) ? row.tags : [],
    published_at: row.published_at || row.ingested_at || new Date().toISOString(),
    ingested_at: row.ingested_at || null,
    relevance_score: Number(row.relevance_score || 0),
    is_featured: !!row.is_featured,
  }));
}

async function fetchCommunityNewsFromSupabase(category = 'all') {
  const client = getCommunityClient();
  if (!client) return { news: [], lastIngestedAt: null };

  let query = client
    .from('community_articles')
    .select('id,title,summary,url,image_url,source,category,tags,published_at,ingested_at,relevance_score,is_featured')
    .eq('is_active', true)
    .order('relevance_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(60);

  if (category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  const mapped = mapCommunityDbRows(data || []);
  const lastIngestedAt = mapped.reduce((acc, item) => {
    if (!item.ingested_at) return acc;
    if (!acc) return item.ingested_at;
    return new Date(item.ingested_at) > new Date(acc) ? item.ingested_at : acc;
  }, null);
  return { news: mapped, lastIngestedAt };
}

async function fetchMarketplaceSignalsFromSupabase(limit = 90) {
  const client = getCommunityClient();
  if (!client) return [];

  const categories = ['marketplace', 'mercado', 'ecommerce', 'importacao', 'plataformas', 'tecnologia', 'estrategia'];
  const { data, error } = await client
    .from('community_articles')
    .select('title,summary,source,category,published_at')
    .eq('is_active', true)
    .in('category', categories)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function fetchCommunityNewsFromRss(category = 'all') {
  // Segurança: não consumir RSS2JSON/NewsAPI no cliente.
  // Fallback mantido apenas com conteúdo editorial local.
  const news = [...FALLBACK_NEWS];
  newsCache.data = news;
  newsCache.timestamp = Date.now();
  communityUsingFallback = true;
  return filterNewsByCategory(news, category);
}

async function fetchCommunityNews(category = 'all') {
  const now = Date.now();
  if (newsCache.data && (now - newsCache.timestamp) < COMMUNITY_CONFIG.CACHE_DURATION) {
    return filterNewsByCategory(newsCache.data, category);
  }

  communityUsingFallback = false;
  communityDataSource = 'fallback';
  communityLastIngestedAt = null;
  communityStaleWarning = '';

  if (COMMUNITY_CONFIG.COMMUNITY_BACKEND_SOURCE === 'supabase') {
    try {
      const { news, lastIngestedAt } = await fetchCommunityNewsFromSupabase('all');
      if (news.length > 0) {
        newsCache.data = news;
        newsCache.timestamp = now;
        communityDataSource = 'supabase';
        communityLastIngestedAt = lastIngestedAt;
        communityStaleWarning = evaluateCommunityFreshness(lastIngestedAt);
        return filterNewsByCategory(news, category);
      }
    } catch (err) {
      __logWarn('[Community] supabase source failed, fallback ativo:', err);
    }
  }

  if (COMMUNITY_CONFIG.COMMUNITY_RSS_FALLBACK_ENABLED) {
    try {
      const rssNews = await fetchCommunityNewsFromRss('all');
      communityDataSource = communityUsingFallback ? 'fallback' : 'rss';
      communityStaleWarning = communityUsingFallback ? 'Feed externo indisponível no momento.' : '';
      return filterNewsByCategory(rssNews, category);
    } catch (_) {
      /* segue fallback estático */
    }
  }

  communityUsingFallback = true;
  communityDataSource = 'fallback';
  communityStaleWarning = 'Exibindo conteúdo editorial local até a próxima atualização.';
  newsCache.data = [...FALLBACK_NEWS];
  newsCache.timestamp = now;
  return filterNewsByCategory(newsCache.data, category);
}

async function fetchRSSFeed(feedConfig) {
  void feedConfig;
  return [];
}

function filterNewsByCategory(news, category) {
  if (category === 'all') return news;
  return news.filter(n => n.category === category);
}

const CATEGORY_CONFIG = {
  importacao: { label: 'Importação', color: '#F97316', icon: '🌐' },
  tributacao: { label: 'Tributação', color: '#F59E0B', icon: '🧾' },
  compliance: { label: 'Compliance', color: '#10B981', icon: '🛡️' },
  ecommerce: { label: 'E-Commerce', color: '#8B5CF6', icon: '🛒' },
  marketplace: { label: 'Marketplace', color: '#EC4899', icon: '🏪' },
  logistics: { label: 'Logística', color: '#F59E0B', icon: '📦' },
  payments: { label: 'Pagamentos', color: '#10B981', icon: '💳' },
  marketing: { label: 'Marketing', color: '#3B82F6', icon: '📢' },
  tech: { label: 'Tecnologia', color: '#06B6D4', icon: '⚡' },
  funding: { label: 'Investimentos', color: '#F97316', icon: '💰' },
  mercado: { label: 'Mercado', color: '#8B5CF6', icon: '📈' },
  plataformas: { label: 'Plataformas', color: '#EC4899', icon: '🧩' },
  tecnologia: { label: 'Tecnologia', color: '#06B6D4', icon: '⚡' },
  estrategia: { label: 'Estratégia', color: '#10B981', icon: '🧭' },
  logistica: { label: 'Logística', color: '#F59E0B', icon: '🚚' },
};

function renderCommunityNews(news) {
  const featured = news.filter(n => n.is_featured).slice(0, 3);
  const regular = news.filter(n => !n.is_featured).slice(0, 12);
  const updatedLabel = formatUpdatedAtLabel(communityLastIngestedAt);
  return `
    <div class="community-wrapper">
      <div class="community-header">
        <div>
          <h1 class="community-title">Comunidade <span class="gradient-text">DestaQ</span></h1>
          <p class="community-subtitle">Notícias e tendências do e-commerce e marketplace brasileiro</p>
        </div>
        <div class="community-live-badge" title="${updatedLabel}">
          <span class="live-dot"></span> ${updatedLabel}
        </div>
      </div>
      <div class="news-category-bar">
        <button class="news-cat-btn active" data-cat="all" onclick="loadNews('all')">🔥 Tudo</button>
        ${Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => `
          <button class="news-cat-btn" data-cat="${key}" onclick="loadNews('${key}')">
            ${cfg.icon} ${cfg.label}
          </button>
        `).join('')}
      </div>
      ${featured.length > 0 ? `
      <div class="news-featured-grid">
        ${featured.map((n, i) => `
          <article class="news-featured-card ${i === 0 ? 'featured-large' : 'featured-small'}" onclick="window.open('${n.url}', '_blank')">
            <div class="news-img-wrapper">
              <img src="${n.image}" alt="${n.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80'">
              <div class="news-img-overlay"></div>
            </div>
            <div class="news-card-body">
              <span class="news-cat-tag" style="color:${CATEGORY_CONFIG[n.category]?.color || '#8B5CF6'}">
                ${CATEGORY_CONFIG[n.category]?.icon || '📰'} ${CATEGORY_CONFIG[n.category]?.label || n.category}
              </span>
              <h3 class="news-title">${n.title}</h3>
              <div class="news-meta">
                <span class="news-source">${n.source}</span>
                <span class="news-time">${formatTimeAgo(n.published_at)} atrás</span>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
      ` : ''}
      <h2 class="news-section-label">Últimas Notícias</h2>
      <div class="news-regular-grid" id="news-regular-grid">
        ${regular.map(n => `
          <article class="news-card" onclick="window.open('${n.url}', '_blank')">
            <div class="news-card-img">
              <img src="${n.image}" alt="${n.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80'">
            </div>
            <div class="news-card-info">
              <span class="news-cat-pill" style="background:${CATEGORY_CONFIG[n.category]?.color || '#8B5CF6'}22;color:${CATEGORY_CONFIG[n.category]?.color || '#8B5CF6'}">
                ${CATEGORY_CONFIG[n.category]?.icon || '📰'} ${CATEGORY_CONFIG[n.category]?.label || n.category}
              </span>
              <h4>${n.title}</h4>
              <p>${n.summary || ''}</p>
              <div class="news-footer">
                <span>${n.source}</span>
                <span>${formatTimeAgo(n.published_at)} atrás</span>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
      ${communityStaleWarning ? `<p style="font-size:0.78rem;opacity:0.78;margin-top:10px">${communityStaleWarning}</p>` : ''}
      ${communityDataSource === 'supabase' ? '<p style="font-size:0.75rem;opacity:0.55;margin-top:8px">Fonte: pipeline híbrido Supabase (RSS + NewsAPI + oficiais)</p>' : ''}
      ${communityUsingFallback ? '<p style="font-size:0.75rem;opacity:0.5;margin-top:10px">📡 Conteúdo editorial — atualizado semanalmente</p>' : ''}
    </div>
  `;
}

async function initCommunityTab() {
  const container = document.getElementById('community-content');
  if (!container) return;

  const skeletonCard = '<div class="skeleton-card"><div class="sk-img"></div><div class="sk-lines"><div class="sk-line sk-w80"></div><div class="sk-line sk-w60"></div><div class="sk-line sk-w40"></div></div></div>';
  container.innerHTML = `<div class="news-loading-skeleton">${Array(6).fill(skeletonCard).join('')}</div>`;

  try {
    const news = await fetchCommunityNews('all');
    container.innerHTML = renderCommunityNews(news);
  } catch (_) {
    communityUsingFallback = true;
    container.innerHTML = renderCommunityNews(FALLBACK_NEWS);
  }
}

window.loadNews = async function(category) {
  document.querySelectorAll('.news-cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === category);
  });
  const grid = document.getElementById('news-regular-grid');
  if (grid) {
    grid.innerHTML = '<div class="news-loading-inline">Carregando...</div>';
    const news = await fetchCommunityNews(category);
    const regular = news.filter(n => !n.is_featured).slice(0, 12);
    grid.innerHTML = regular.map(n => `
      <article class="news-card" onclick="window.open('${n.url}', '_blank')">
        <div class="news-card-img">
          <img src="${n.image}" alt="${n.title}" loading="lazy">
        </div>
        <div class="news-card-info">
          <span class="news-cat-pill" style="background:${CATEGORY_CONFIG[n.category]?.color || '#8B5CF6'}22;color:${CATEGORY_CONFIG[n.category]?.color || '#8B5CF6'}">
            ${CATEGORY_CONFIG[n.category]?.icon || '📰'} ${CATEGORY_CONFIG[n.category]?.label || n.category}
          </span>
          <h4>${n.title}</h4>
          <p>${n.summary || ''}</p>
          <div class="news-footer">
            <span>${n.source}</span>
            <span>${formatTimeAgo(n.published_at)} atrás</span>
          </div>
        </div>
      </article>
    `).join('');
  }
};

function formatTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return "instantes";
    if (diffHrs < 24) return `${diffHrs}h`;
    return `${Math.floor(diffHrs / 24)}d`;
}

window.handleLike = async function(postId) {
    if (typeof PopupSystem !== 'undefined') {
        PopupSystem.toast({
            icon: '🔥',
            title: 'Insight curtido!',
            sub: 'DestaQ Network'
        });
    }
    // Update local count ou Supabase rpc call
};
