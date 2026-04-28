const fs = require('fs');
const css = `

/* ===== COMMUNITY NEWS (Light Theme Adapted) ===== */
.community-wrapper { padding: 40px 20px; max-width: 1200px; margin: 0 auto; }

.community-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 32px; flex-wrap: wrap; gap: 16px;
}

.community-title {
  font-family: 'Bebas Neue', cursive; font-size: clamp(2rem, 5vw, 3rem);
  color: var(--text-primary); margin: 0 0 6px; letter-spacing: 2px;
}

.community-subtitle { color: var(--text-secondary); font-size: 0.9rem; }

.community-live-badge {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 100px;
  background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3);
  color: #10B981; font-size: 0.8rem; font-weight: 600;
}

.live-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #10B981;
  animation: pulse-live 1.5s infinite;
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* Category bar */
.news-category-bar {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 20px;
  scrollbar-width: none; flex-wrap: wrap;
}
.news-category-bar::-webkit-scrollbar { display: none; }

.news-cat-btn {
  padding: 6px 14px; border-radius: 100px; border: 1px solid var(--border-color);
  background: var(--secondary-dark); color: var(--text-secondary);
  font-size: 0.82rem; cursor: pointer; white-space: nowrap; transition: all 0.2s;
}
.news-cat-btn.active, .news-cat-btn:hover {
  background: rgba(139,92,246,0.2); border-color: var(--accent-purple); color: var(--text-primary);
}

/* Featured Grid */
.news-featured-grid {
  display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: auto auto;
  gap: 16px; margin-bottom: 40px;
}

.news-featured-card {
  position: relative; border-radius: 16px; overflow: hidden; cursor: pointer;
  border: 1px solid var(--border-color); transition: all 0.3s ease;
}
.news-featured-card:hover { transform: translateY(-4px); border-color: var(--accent-purple); }
.featured-large { grid-row: span 2; min-height: 380px; }
.featured-small { min-height: 180px; }

.news-img-wrapper { position: absolute; inset: 0; }
.news-img-wrapper img { width: 100%; height: 100%; object-fit: cover; }
.news-img-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(8,6,20,0.95) 30%, rgba(8,6,20,0.2) 100%);
}

.news-card-body {
  position: absolute; bottom: 0; left: 0; right: 0; padding: 20px;
}
.news-cat-tag { font-size: 0.75rem; font-weight: 600; margin-bottom: 8px; display: block; }
.news-title { color: #fff; font-size: 1.1rem; font-weight: 700; margin: 0 0 10px; line-height: 1.4; }
.featured-small .news-title { font-size: 0.9rem; }
.news-meta { display: flex; gap: 12px; font-size: 0.75rem; color: rgba(255,255,255,0.7); }

/* Regular Grid */
.news-section-label {
  font-family: 'Bebas Neue', cursive; font-size: 1.4rem; letter-spacing: 2px;
  color: var(--text-secondary); margin: 0 0 20px; border-bottom: 1px solid var(--border-color);
  padding-bottom: 12px;
}

.news-regular-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
}

.news-card {
  display: flex; flex-direction: column; background: var(--card-bg);
  border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;
  cursor: pointer; transition: all 0.3s ease;
}
.news-card:hover { border-color: var(--accent-purple); transform: translateY(-3px); }

.news-card-img { height: 160px; overflow: hidden; }
.news-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
.news-card:hover .news-card-img img { transform: scale(1.05); }

.news-card-info { padding: 16px; flex: 1; display: flex; flex-direction: column; }
.news-cat-pill {
  display: inline-block; padding: 3px 10px; border-radius: 100px;
  font-size: 0.72rem; font-weight: 600; margin-bottom: 10px; align-self: flex-start;
}
.news-card-info h4 { color: var(--text-primary); font-size: 0.9rem; font-weight: 600; line-height: 1.4; margin: 0 0 8px; }
.news-card-info p { color: var(--text-secondary); font-size: 0.8rem; line-height: 1.5; flex: 1; }
.news-footer { display: flex; justify-content: space-between; margin-top: 12px; font-size: 0.75rem; color: var(--text-secondary); }

/* Skeletons */
.news-loading-skeleton { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 40px 20px; }
.skeleton-card { background: var(--secondary-dark); border-radius: 12px; overflow: hidden; }
.sk-img { height: 160px; background: linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
.sk-lines { padding: 16px; }
.sk-line { height: 12px; border-radius: 6px; margin-bottom: 10px; background: linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
.sk-w80 { width: 80%; }
.sk-w60 { width: 60%; }
.sk-w40 { width: 40%; }

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (max-width: 768px) {
  .news-featured-grid { grid-template-columns: 1fr; grid-template-rows: auto; }
  .featured-large { min-height: 280px; grid-row: span 1; }
}
`;
fs.appendFileSync('c:/Users/Samukinha/Desktop/Destaq-MOV/scroll-demo/style.css', css);
console.log('APPENDED');
