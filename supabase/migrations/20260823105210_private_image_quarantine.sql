update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'private-pokemon-images';

drop policy "private Pokemon images select own portrait" on storage.objects;
drop policy "private Pokemon images insert own portrait" on storage.objects;
drop policy "private Pokemon images update own portrait" on storage.objects;
drop policy "private Pokemon images delete own portrait" on storage.objects;

create policy "private Pokemon images select own objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and (
        name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
        or (
          (storage.foldername(name))[1] = (select auth.uid())::text
          and (storage.foldername(name))[2] = pokemon.id::text
          and (storage.foldername(name))[3] = 'incoming'
          and array_length(storage.foldername(name), 1) = 3
        )
      )
  )
);

create policy "private Pokemon images insert own objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and (
        name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
        or (
          (storage.foldername(name))[1] = (select auth.uid())::text
          and (storage.foldername(name))[2] = pokemon.id::text
          and (storage.foldername(name))[3] = 'incoming'
          and array_length(storage.foldername(name), 1) = 3
        )
      )
  )
);

create policy "private Pokemon images update own portrait"
on storage.objects for update to authenticated
using (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
  )
)
with check (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1 from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
  )
);

create policy "private Pokemon images delete own objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'private-pokemon-images'
  and exists (
    select 1
    from public.owned_pokemon as pokemon
    where pokemon.user_id = (select auth.uid())
      and (
        name = (select auth.uid())::text || '/' || pokemon.id::text || '/portrait.webp'
        or (
          (storage.foldername(name))[1] = (select auth.uid())::text
          and (storage.foldername(name))[2] = pokemon.id::text
          and (storage.foldername(name))[3] = 'incoming'
          and array_length(storage.foldername(name), 1) = 3
        )
      )
  )
);
