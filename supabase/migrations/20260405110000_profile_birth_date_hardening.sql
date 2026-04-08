update public.profiles
set birth_date = null
where birth_date is not null
  and (
      birth_date > timezone('utc', now())::date
      or birth_date > (timezone('utc', now())::date - interval '13 years')::date
      or birth_date < (timezone('utc', now())::date - interval '120 years')::date
  );
