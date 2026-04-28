-- Atualiza os números das 3 vendedoras do sorteio aleatório.
-- Mantém somente estas 3 ativas para o RPC get_random_active_seller().

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.seller_whatsapp_qr) < 3 THEN
    INSERT INTO public.seller_whatsapp_qr (seller_name, whatsapp_number, qr_image_url, is_active, priority)
    SELECT
      'Vendedora provisória #' || gs::text,
      '550000000000' || gs::text,
      'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fwa.me%2F550000000000' || gs::text,
      false,
      1000 + gs
    FROM generate_series(1, 3 - (SELECT COUNT(*) FROM public.seller_whatsapp_qr)) AS gs;
  END IF;
END;
$$;

WITH desired AS (
  SELECT *
  FROM (
    VALUES
      (1, 'Camila - Destaq'::text,   '5516991598880'::text, 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fwa.me%2F5516991598880'::text, 10),
      (2, 'Fernanda - Destaq'::text, '5511949034031'::text, 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fwa.me%2F5511949034031'::text, 20),
      (3, 'Patricia - Destaq'::text, '5511969676644'::text, 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fwa.me%2F5511969676644'::text, 30)
  ) AS v(rn, seller_name, whatsapp_number, qr_image_url, priority)
),
ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY priority, created_at, id) AS rn
  FROM public.seller_whatsapp_qr
),
updated AS (
  UPDATE public.seller_whatsapp_qr s
  SET
    seller_name = d.seller_name,
    whatsapp_number = d.whatsapp_number,
    qr_image_url = d.qr_image_url,
    is_active = true,
    priority = d.priority,
    updated_at = now()
  FROM ranked r
  JOIN desired d ON d.rn = r.rn
  WHERE s.id = r.id
  RETURNING s.id
)
UPDATE public.seller_whatsapp_qr s
SET
  is_active = false,
  updated_at = now()
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 3;
