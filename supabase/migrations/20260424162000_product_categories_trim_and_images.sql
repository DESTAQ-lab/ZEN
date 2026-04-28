-- Keep only requested product categories and align product imagery by category

WITH target_categories(slug, name, display_order) AS (
  VALUES
    ('acessorios-veiculos', 'Acessórios para Veículos', 1),
    ('pet-shop', 'Pet Shop', 2),
    ('arte-papelaria-armarinho', 'Arte, Papelaria e Armarinho', 3),
    ('bebes', 'Bebês', 4),
    ('beleza-cuidado-pessoal', 'Beleza e Cuidado Pessoal', 5),
    ('brinquedos-hobbies', 'Brinquedos e Hobbies', 6),
    ('calcados-roupas-bolsas', 'Calçados, Roupas e Bolsas', 7),
    ('cameras-acessorios', 'Câmeras e Acessórios', 8),
    ('casa-moveis-decoracao', 'Casa, Móveis e Decoração', 9),
    ('celulares-telefones', 'Celulares e Telefones', 10),
    ('acessorios-celulares', 'Acessórios para Celulares', 11),
    ('eletrodomesticos', 'Eletrodomésticos', 12),
    ('eletronicos-audio-video', 'Eletrônicos, Áudio e Vídeo', 13),
    ('esportes-fitness', 'Esportes e Fitness', 14),
    ('ferramentas', 'Ferramentas', 15),
    ('festas-lembrancinhas', 'Festas e Lembrancinhas', 16),
    ('informatica', 'Informática', 17)
)
INSERT INTO public.product_categories (slug, name, display_order, is_active)
SELECT slug, name, display_order, true
FROM target_categories
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  is_active = true;

UPDATE public.product_categories
SET is_active = false
WHERE slug NOT IN (
  'acessorios-veiculos','pet-shop','arte-papelaria-armarinho','bebes','beleza-cuidado-pessoal',
  'brinquedos-hobbies','calcados-roupas-bolsas','cameras-acessorios','casa-moveis-decoracao',
  'celulares-telefones','acessorios-celulares','eletrodomesticos','eletronicos-audio-video',
  'esportes-fitness','ferramentas','festas-lembrancinhas','informatica'
);

UPDATE public.product_catalog
SET is_active = false;

WITH rows(category_slug, name, slug, image_url, badge_text, min_order_qty, is_featured, search_tokens) AS (
  VALUES
    ('acessorios-veiculos','Kit Acessórios Automotivos','kit-acessorios-automotivos','https://images.unsplash.com/photo-1486496572940-2bb2341fdbdf?w=800&q=80','Auto',20,true,ARRAY['acessorios','veiculo']),
    ('pet-shop','Kit Pet Premium','kit-pet-premium','https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800&q=80','Pet',30,true,ARRAY['pet','animais']),
    ('arte-papelaria-armarinho','Kit Papelaria Criativa','kit-papelaria-criativa','https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80','Papelaria',80,false,ARRAY['papelaria','armarinho']),
    ('bebes','Linha Bebês Conforto','linha-bebes-conforto','https://images.unsplash.com/photo-1544126592-807ade215a0b?w=800&q=80','Bebês',25,false,ARRAY['bebes']),
    ('beleza-cuidado-pessoal','Beleza e Cuidados','beleza-cuidados','https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80','Beleza',40,false,ARRAY['beleza','cuidado']),
    ('brinquedos-hobbies','Brinquedos Educativos','brinquedos-educativos','https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&q=80','Kids',40,false,ARRAY['brinquedos','hobbies']),
    ('calcados-roupas-bolsas','Moda e Bolsas','moda-bolsas','https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80','Moda',60,false,ARRAY['calcados','roupas','bolsas']),
    ('cameras-acessorios','Câmeras Mirrorless','cameras-mirrorless','https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80','Foto',12,true,ARRAY['camera','acessorios']),
    ('casa-moveis-decoracao','Casa e Decoração','casa-decoracao','https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80','Casa',20,false,ARRAY['casa','moveis','decoracao']),
    ('celulares-telefones','Celulares 5G','celulares-5g','https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80','Mobile',50,true,ARRAY['celulares','telefones']),
    ('acessorios-celulares','Acessórios para Celular','acessorios-celular','https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&q=80','Acessórios',80,false,ARRAY['acessorios','celular']),
    ('eletrodomesticos','Linha Eletrodomésticos','linha-eletrodomesticos','https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&q=80','Casa',20,false,ARRAY['eletrodomesticos']),
    ('eletronicos-audio-video','Drones 4K','drones-4k-top','https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=80','Eletrônicos',15,true,ARRAY['eletronicos','audio','video','drone']),
    ('esportes-fitness','Esportes e Fitness','esportes-fitness-b2b','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80','Fitness',25,false,ARRAY['esportes','fitness']),
    ('ferramentas','Ferramentas Profissionais','ferramentas-profissionais','https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80','B2B',15,false,ARRAY['ferramentas']),
    ('festas-lembrancinhas','Festas e Lembrancinhas','festas-lembrancinhas-b2b','https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=800&q=80','Festas',50,false,ARRAY['festas','lembrancinhas']),
    ('informatica','Informática Corporativa','informatica-corporativa','https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80','TI',18,false,ARRAY['informatica'])
)
INSERT INTO public.product_catalog (
  category_id, name, slug, image_url, badge_text, min_order_qty, is_featured, is_active, search_tokens
)
SELECT c.id, r.name, r.slug, r.image_url, r.badge_text, r.min_order_qty, r.is_featured, true, r.search_tokens
FROM rows r
JOIN public.product_categories c ON c.slug = r.category_slug
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  badge_text = EXCLUDED.badge_text,
  min_order_qty = EXCLUDED.min_order_qty,
  is_featured = EXCLUDED.is_featured,
  is_active = true,
  search_tokens = EXCLUDED.search_tokens;
