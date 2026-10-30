import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const C = '00000000-0000-0000-0000-000000000003';
let db;
async function as(id, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const save = (id, kind, mediaType = 'movie', mediaId = 1) => as(id,
  'select public.save_media($1, $2, $3, $4, $5, $6, $7, $8)',
  [kind, 'tmdb', mediaType, mediaId, 'Example film', 'ta', '2021', null]);

before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${A}'),('${B}'),('${C}');`);
  await db.exec(await readFile(new URL('../migrations/202610290001_accounts_and_friends.sql', import.meta.url), 'utf8'));
  for (const [id, username] of [[A, 'alice'], [B, 'bob'], [C, 'carol']]) {
    await as(id, 'insert into public.profiles(id,username,display_name) values($1,$2,$3)', [id, username, username]);
  }
});
after(async () => { await db?.close(); });

test('profiles contain no emails; users cannot create or edit another identity', async () => {
  assert.equal((await as(A, 'select * from public.profiles')).rows.length, 3);
  assert.equal('email' in (await as(A, 'select * from public.profiles limit 1')).rows[0], false);
  await assert.rejects(as(A, 'update public.profiles set username = $1 where id=$2', ['hijack', B]));
  assert.equal((await as(A, 'update public.profiles set display_name=$1 where id=$2 returning id', ['Hijacked', B])).rows.length, 0);
  await assert.rejects(as(A, 'insert into public.profiles(id, username, display_name) values($1,$2,$3)', ['00000000-0000-0000-0000-000000000004','forged','forged']));
});

test('private collections do not leak to strangers; inserts cannot forge the owner', async () => {
  await save(A, 'watchlist'); await save(A, 'watched', 'tv', 1);
  assert.equal((await as(B, 'select * from public.user_media')).rows.length, 0);
  await assert.rejects(as(B, `insert into public.user_media(user_id,collection,source_mode,media_type,media_id,title)
    values($1,'watched','tmdb','movie',99,'Forged')`, [A]));
});

test('only the recipient can accept a pending request; pending requests grant no history access', async () => {
  await as(A, 'insert into public.friendships(user_low,user_high,requested_by) values($1,$2,$1)', [A, B]);
  assert.equal((await as(B, 'select * from public.user_media')).rows.length, 0);
  await assert.rejects(as(A, 'select public.accept_friend($1)', [B]));
  await assert.rejects(as(C, 'select public.accept_friend($1)', [A]));
  await assert.rejects(as(A, "update public.friendships set status='accepted'"));
  await as(B, 'select public.accept_friend($1)', [A]);
  assert.equal((await as(B, 'select * from public.user_media')).rows[0].collection, 'watched');
});

test('accepted friends see shared watched history but never a private watchlist', async () => {
  const rows = (await as(B, 'select * from public.user_media')).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].collection, 'watched'); assert.equal(rows[0].user_id, A);
  assert.equal((await as(C, 'select * from public.user_media')).rows.length, 0);
});

test('privacy toggle hides watched history immediately, including per-title queries', async () => {
  await as(A, 'update public.profiles set share_watched=false where id=$1', [A]);
  assert.equal((await as(B, "select * from public.user_media where media_type='tv' and media_id=1")).rows.length, 0);
  await as(A, 'update public.profiles set share_watched=true where id=$1', [A]);
  assert.equal((await as(B, 'select * from public.user_media')).rows.length, 1);
});

test('watched move is atomic/idempotent and movie/series IDs remain separate', async () => {
  await save(A, 'watched', 'movie', 1);
  await save(A, 'watched', 'movie', 1);
  const rows = (await as(A, 'select * from public.user_media')).rows;
  assert.equal(rows.length, 2); assert.ok(rows.every(row => row.collection === 'watched'));
  assert.deepEqual(rows.map(row => row.media_type).sort(), ['movie', 'tv']);
  await assert.rejects(as(A, "select public.save_media('watched','tmdb','movie',2,'Bad image','ta','2021','https://tracker.example/photo')"));
});

test('recommendations require friendship, cannot spoof sender and are private to participants', async () => {
  const insert = (who, sender, recipient, mediaId) => as(who, `insert into public.recommendations(sender_id,recipient_id,source_mode,media_type,media_id,title,note)
    values($1,$2,'tmdb','movie',$3,'Example film','Try this')`, [sender, recipient, mediaId]);
  await assert.rejects(insert(C, C, A, 2));
  await assert.rejects(insert(C, A, B, 2));
  await insert(A, A, B, 2);
  assert.equal((await as(B, 'select * from public.recommendations')).rows.length, 1);
  assert.equal((await as(C, 'select * from public.recommendations')).rows.length, 0);
  await assert.rejects(insert(A, A, B, 2));
});

test('unfriending immediately removes watched access and prevents new recommendations', async () => {
  await as(B, 'delete from public.friendships where user_low=$1 and user_high=$2', [A, B]);
  assert.equal((await as(B, 'select * from public.user_media')).rows.length, 0);
  await assert.rejects(as(A, `insert into public.recommendations(sender_id,recipient_id,source_mode,media_type,media_id,title)
    values($1,$2,'tmdb','movie',3,'Example')`, [A, B]));
});

test('anonymous requests cannot read collections, profiles, relationships or invoke write functions', async () => {
  await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false);");
  try {
    for (const table of ['profiles','user_media','friendships','recommendations']) await assert.rejects(db.query(`select * from public.${table}`));
    await assert.rejects(db.query('select public.accept_friend($1)', [A]));
    await assert.rejects(db.query("select public.save_media('watched','tmdb','movie',1,'Example','','',null)"));
  } finally { await db.exec('reset role'); }
});
