DO $do$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.fuzzy_search_jobs(text,text,text,text,integer,integer,text,integer,integer,text,text)'::regprocedure) INTO d;
  d := replace(d, 'similarity(lower(j.title), t) > 0.25', '(length(t) >= 4 AND word_similarity(t, lower(j.title)) > 0.45)');
  d := replace(d, 'similarity(lower(skill), t) > 0.3', '(length(t) >= 4 AND word_similarity(t, lower(skill)) > 0.45)');
  d := replace(d, 'similarity(lower(j.title || '' '' || COALESCE(j.description,'''')), normalized_query) > 0.08', 'length(normalized_query) >= 4 AND word_similarity(normalized_query, lower(j.title || '' '' || COALESCE(j.description,''''))) > 0.5');
  EXECUTE d;
END
$do$;