-- Produto marketplace core tables and policies

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  badge_text text,
  min_order_qty integer NOT NULL DEFAULT 1 CHECK (min_order_qty > 0),
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  search_tokens text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_whatsapp_qr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_name text NOT NULL,
  whatsapp_number text NOT NULL,
  qr_image_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  requested_product_name text NOT NULL,
  min_quantity integer NOT NULL CHECK (min_quantity > 0),
  reference_image_url text,
  selected_seller_id uuid REFERENCES public.seller_whatsapp_qr(id) ON DELETE SET NULL,
  selected_seller_name text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_active_order
  ON public.product_categories (is_active, display_order);

CREATE INDEX IF NOT EXISTS idx_product_catalog_category_active
  ON public.product_catalog (category_id, is_active, is_featured);

CREATE INDEX IF NOT EXISTS idx_product_catalog_search_tokens
  ON public.product_catalog USING gin (search_tokens);

CREATE INDEX IF NOT EXISTS idx_product_inquiries_created_at
  ON public.product_inquiries (created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_categories_touch_updated_at ON public.product_categories;
CREATE TRIGGER trg_product_categories_touch_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_product_catalog_touch_updated_at ON public.product_catalog;
CREATE TRIGGER trg_product_catalog_touch_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_seller_whatsapp_qr_touch_updated_at ON public.seller_whatsapp_qr;
CREATE TRIGGER trg_seller_whatsapp_qr_touch_updated_at
  BEFORE UPDATE ON public.seller_whatsapp_qr
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_updated_at();

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_whatsapp_qr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_public_active_select" ON public.product_categories;
CREATE POLICY "product_categories_public_active_select"
  ON public.product_categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "product_catalog_public_active_select" ON public.product_catalog;
CREATE POLICY "product_catalog_public_active_select"
  ON public.product_catalog
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "product_inquiries_insert_public" ON public.product_inquiries;
CREATE POLICY "product_inquiries_insert_public"
  ON public.product_inquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(customer_name)) >= 2
    AND length(regexp_replace(customer_phone, '\D', '', 'g')) BETWEEN 10 AND 15
    AND length(trim(requested_product_name)) >= 2
    AND min_quantity > 0
  );

DROP POLICY IF EXISTS "product_inquiries_service_role_all" ON public.product_inquiries;
CREATE POLICY "product_inquiries_service_role_all"
  ON public.product_inquiries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "seller_whatsapp_qr_service_role_all" ON public.seller_whatsapp_qr;
CREATE POLICY "seller_whatsapp_qr_service_role_all"
  ON public.seller_whatsapp_qr
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_random_active_seller()
RETURNS TABLE (
  id uuid,
  seller_name text,
  whatsapp_number text,
  qr_image_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.seller_name, s.whatsapp_number, s.qr_image_url
  FROM public.seller_whatsapp_qr s
  WHERE s.is_active = true
  ORDER BY random(), s.priority ASC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_random_active_seller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_random_active_seller() TO anon, authenticated, service_role;

-- Storage bucket for reference images from modal inquiry
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-inquiry-images', 'product-inquiry-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_inquiry_images_public_select" ON storage.objects;
CREATE POLICY "product_inquiry_images_public_select"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-inquiry-images');

DROP POLICY IF EXISTS "product_inquiry_images_public_insert" ON storage.objects;
CREATE POLICY "product_inquiry_images_public_insert"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'product-inquiry-images'
    AND length(name) > 3
  );

GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT SELECT ON public.product_catalog TO anon, authenticated;
GRANT INSERT ON public.product_inquiries TO anon, authenticated;
GRANT ALL ON public.product_categories TO service_role;
GRANT ALL ON public.product_catalog TO service_role;
GRANT ALL ON public.seller_whatsapp_qr TO service_role;
GRANT ALL ON public.product_inquiries TO service_role;
