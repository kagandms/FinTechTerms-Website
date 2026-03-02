-- ==========================================
-- FINTECHTERMS: TRİGRAM VE FUZZY SEARCH (O(logN)) MİGRASYONU
-- ==========================================
-- Bu script Supabase SQL Editor üzerinden çalıştırılmalıdır.

-- 1. pg_trgm uzantısını (extension) aktifleştir:
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. "terms" tablosundaki İngilizce, Türkçe ve Rusça terim sütunları için GIN indeksleri yarat:
-- Bu indeksler, ilike ve % pattern aramalarının tabloda tam tarama (Full Table Scan) yapmasını engeller
-- ve sorgu maliyetini O(N)'den O(log N)'e düşürür.
CREATE INDEX IF NOT EXISTS terms_en_trgm_idx ON terms USING GIN (term_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS terms_tr_trgm_idx ON terms USING GIN (term_tr gin_trgm_ops);
CREATE INDEX IF NOT EXISTS terms_ru_trgm_idx ON terms USING GIN (term_ru gin_trgm_ops);
CREATE INDEX IF NOT EXISTS def_en_trgm_idx ON terms USING GIN (definition_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS def_tr_trgm_idx ON terms USING GIN (definition_tr gin_trgm_ops);
CREATE INDEX IF NOT EXISTS def_ru_trgm_idx ON terms USING GIN (definition_ru gin_trgm_ops);

-- 3. Stored Procedure (RPC) oluştur: Telegram Botunuz tek bir RPC çağrısıyla tüm dillerde fuzzy search yapabilsin
CREATE OR REPLACE FUNCTION search_terms_trigram(search_query text, max_limit int DEFAULT 10)
RETURNS SETOF terms AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM terms
  WHERE
    term_en ILIKE '%' || search_query || '%' OR
    term_tr ILIKE '%' || search_query || '%' OR
    term_ru ILIKE '%' || search_query || '%' OR
    definition_en ILIKE '%' || search_query || '%' OR
    definition_tr ILIKE '%' || search_query || '%' OR
    definition_ru ILIKE '%' || search_query || '%'
  ORDER BY
    -- En yakın eşleşmeyi (similarity) en üste getir (pg_trgm metodu)
    greatest(
        similarity(term_en, search_query),
        similarity(term_tr, search_query),
        similarity(term_ru, search_query)
    ) DESC
  LIMIT max_limit;
END;
$$ LANGUAGE plpgsql;
