create unique index owned_pokemon_images_one_portrait_idx
on public.owned_pokemon_images (owned_pokemon_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'private-pokemon-images',
  'private-pokemon-images',
  false,
  5242880,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "private Pokemon images select own portrait"
on storage.objects for select to authenticated
using (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
  )
);

create policy "private Pokemon images insert own portrait"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
  )
);

create policy "private Pokemon images update own portrait"
on storage.objects for update to authenticated
using (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
  )
)
with check (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
  )
);

create policy "private Pokemon images delete own portrait"
on storage.objects for delete to authenticated
using (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
  )
);
