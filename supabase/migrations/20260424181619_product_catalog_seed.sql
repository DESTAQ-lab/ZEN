-- Seed Produto marketplace data (categories, catalog, sellers)

INSERT INTO public.product_categories (slug, name, display_order, is_active)
VALUES
  ('roupas-acessorios', 'Roupas e Acessórios', 1, true),
  ('produtos-eletronicos', 'Produtos Eletrônicos', 2, true),
  ('esportes-entretenimento', 'Esportes e Entretenimento', 3, true),
  ('bebes-criancas-brinquedos', 'Bebês, Crianças e Brinquedos', 4, true),
  ('eletrodomesticos', 'Eletrodomésticos', 5, true),
  ('casa-jardim', 'Casa e Jardim', 6, true),
  ('vestuario-esportes-ar-livre', 'Vestuário de Esportes e Atividades ao Ar Livre', 7, true),
  ('beleza', 'Beleza', 8, true),
  ('joias-oculos-relogios', 'Joias, Óculos e Relógios', 9, true),
  ('calcados-acessorios', 'Calçados e Acessórios', 10, true),
  ('malas-bolsas-pastas', 'Malas, Bolsas e Pastas', 11, true),
  ('embalagem-impressao', 'Embalagem e Impressão', 12, true),
  ('cuidado-pessoal-casa', 'Cuidado Pessoal e da Casa', 13, true),
  ('saude-medicina', 'Saúde e Medicina', 14, true),
  ('presentes-artesanato', 'Presentes e Artesanato', 15, true),
  ('pet-shop', 'Pet Shop', 16, true),
  ('material-escolar-escritorio', 'Material Escolar e de Escritório', 17, true),
  ('maquinas-industriais', 'Máquinas Industriais', 18, true),
  ('equipamentos-maquinas-comerciais', 'Equipamentos e Máquinas Comerciais', 19, true),
  ('maquinas-construcao-civil', 'Máquinas de Construção Civil', 20, true),
  ('construcao-imoveis', 'Construção e Imóveis', 21, true),
  ('moveis', 'Móveis', 22, true),
  ('luzes-iluminacao', 'Luzes e Iluminação', 23, true),
  ('ferramentas-pecas-veiculos', 'Ferramentas e Peças para Veículos', 24, true),
  ('pecas-acessorios-veiculos', 'Peças e Acessórios para Veículos', 25, true),
  ('ferramentas-hardware', 'Ferramentas e Hardware', 26, true),
  ('energia-renovavel', 'Energia Renovável', 27, true),
  ('materiais-equipamentos-eletricos', 'Materiais e Equipamentos Elétricos', 28, true),
  ('protecao-seguranca', 'Proteção e Segurança', 29, true),
  ('manuseio-cargas', 'Manuseio de Cargas', 30, true),
  ('instrumento-equipamento-teste', 'Instrumento e Equipamento de Teste', 31, true),
  ('transmissao-energia', 'Transmissão de Energia', 32, true),
  ('componentes-eletronicos', 'Componentes Eletrônicos', 33, true),
  ('veiculos-transporte', 'Veículos e transporte', 34, true),
  ('agricultura-alimentos-bebidas', 'Agricultura, Alimentos e Bebidas', 35, true),
  ('materias-primas', 'Matérias-primas', 36, true),
  ('fabricacao-industrial', 'Fabricação e Industrial', 37, true),
  ('servicos', 'Serviços', 38, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

WITH cat AS (
  SELECT id, slug FROM public.product_categories
)
INSERT INTO public.product_catalog (
  category_id, name, slug, image_url, badge_text, min_order_qty, is_featured, is_active, search_tokens
)
SELECT cat.id, x.name, x.slug, x.image_url, x.badge_text, x.min_order_qty, x.is_featured, true, x.search_tokens
FROM cat
JOIN (
  VALUES
    ('produtos-eletronicos', 'Smartphone 5G', 'smartphone-5g', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80', 'Alta procura', 50, true, ARRAY['smartphone','5g','eletronicos','mobile']),
    ('produtos-eletronicos', 'Portáteis Premium', 'portateis-premium', 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?w=800&q=80', 'Top Seller', 20, true, ARRAY['notebook','portatil','eletronicos']),
    ('produtos-eletronicos', 'Drones 4K', 'drones-4k', 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=80', 'Lançamento', 15, true, ARRAY['drone','camera','aereo']),
    ('veiculos-transporte', 'Patinetes elétricos', 'patinetes-eletricos', 'https://images.unsplash.com/photo-1570116941082-34f3f759ee47?w=800&q=80', 'Tendência', 10, true, ARRAY['patinete','eletrico','mobilidade']),
    ('veiculos-transporte', 'Motocicletas Elétricas', 'motocicletas-eletricas', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&q=80', 'Em alta', 5, true, ARRAY['moto','eletrica','transporte']),
    ('veiculos-transporte', 'Carros elétricos compactos', 'carros-eletricos-compactos', 'https://images.unsplash.com/photo-1593941707882-a5bba53b4c20?w=800&q=80', 'Novo', 2, false, ARRAY['carro','eletrico']),
    ('roupas-acessorios', 'Moletons streetwear', 'moletons-streetwear', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80', 'Coleção', 80, true, ARRAY['moletom','moda','streetwear']),
    ('roupas-acessorios', 'Vestidos de noiva', 'vestidos-noiva', 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=800&q=80', 'Premium', 6, true, ARRAY['vestido','noiva','festa']),
    ('roupas-acessorios', 'Vestidos de noite', 'vestidos-noite', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80', 'Fashion', 30, false, ARRAY['vestido','noite','moda']),
    ('roupas-acessorios', 'Vestido Africano', 'vestido-africano', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80', 'Destaque', 25, false, ARRAY['vestido','africano']),
    ('roupas-acessorios', 'Vestido de praia', 'vestido-praia', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80', 'Verão', 40, false, ARRAY['vestido','praia']),
    ('roupas-acessorios', 'Camisa de beisebol', 'camisa-beisebol', 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=800&q=80', 'Esporte', 60, false, ARRAY['camisa','beisebol']),
    ('roupas-acessorios', 'Roupão de banho', 'roupao-banho', 'https://images.unsplash.com/photo-1618677603286-0ec56cb6e1b9?w=800&q=80', 'Casa', 35, false, ARRAY['roupao','banho']),
    ('roupas-acessorios', 'Shorts de basquete', 'shorts-basquete', 'https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?w=800&q=80', 'Ativo', 50, false, ARRAY['shorts','basquete']),
    ('roupas-acessorios', 'Roupas de anime', 'roupas-anime', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80', 'Geek', 45, false, ARRAY['anime','camiseta']),
    ('roupas-acessorios', 'Bonés de beisebol', 'bones-beisebol', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80', 'Acessório', 120, false, ARRAY['bone','beisebol']),
    ('beleza', 'Perucas premium', 'perucas-premium', 'https://images.unsplash.com/photo-1596704017256-9f99beacdf53?w=800&q=80', 'Beleza', 20, true, ARRAY['peruca','beleza']),
    ('produtos-eletronicos', 'Smart TVs 4K', 'smart-tvs-4k', 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&q=80', 'Home tech', 8, false, ARRAY['tv','smarttv']),
    ('produtos-eletronicos', 'Câmera mirrorless', 'camera-mirrorless', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80', 'Creator', 12, false, ARRAY['camera','foto']),
    ('material-escolar-escritorio', 'Cadernos executivos', 'cadernos-executivos', 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80', 'Volta às aulas', 100, false, ARRAY['caderno','papelaria']),
    ('pet-shop', 'Coleira inteligente pet', 'coleira-inteligente-pet', 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80', 'Pet tech', 40, false, ARRAY['pet','coleira']),
    ('casa-jardim', 'Kit jardinagem doméstica', 'kit-jardinagem-domestica', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80', 'Casa e Jardim', 25, false, ARRAY['jardim','casa']),
    ('ferramentas-hardware', 'Parafusadeira industrial', 'parafusadeira-industrial', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80', 'B2B', 15, false, ARRAY['ferramenta','hardware']),
    ('energia-renovavel', 'Painel solar modular', 'painel-solar-modular', 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80', 'Sustentável', 10, false, ARRAY['energia','solar']),
    ('agricultura-alimentos-bebidas', 'Snacks naturais', 'snacks-naturais', 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=800&q=80', 'Alimentos', 200, false, ARRAY['alimento','snack'])
) AS x(category_slug, name, slug, image_url, badge_text, min_order_qty, is_featured, search_tokens)
  ON x.category_slug = cat.slug
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  badge_text = EXCLUDED.badge_text,
  min_order_qty = EXCLUDED.min_order_qty,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  search_tokens = EXCLUDED.search_tokens;

INSERT INTO public.seller_whatsapp_qr (seller_name, whatsapp_number, qr_image_url, is_active, priority)
VALUES
  (
    'Camila - Destaq',
    '5516991598880',
    'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fwa.me%2F5516991598880',
    true,
    10
  ),
  (
    'Fernanda - Destaq',
    '5511949034031',
    'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fwa.me%2F5511949034031',
    true,
    20
  ),
  (
    'Patricia - Destaq',
    '5511969676644',
    'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fwa.me%2F5511969676644',
    true,
    30
  )
ON CONFLICT DO NOTHING;
