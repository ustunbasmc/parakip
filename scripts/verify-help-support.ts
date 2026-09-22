/**
 * Yardım Merkezi + Destek sistemi (migration 0061/0062) için veritabanı
 * seviyesinde RLS/iş kuralı doğrulaması.
 *
 * GÜVENLİ: Her şey TEK bir transaction içinde çalışır ve sonunda
 * ROLLBACK edilir — test kullanıcıları, talepler, storage kayıtları ve
 * (henüz uygulanmamışsa) migration'ların kendisi KALICI olarak YAZILMAZ.
 *
 * Kullanım:
 *   npx tsx scripts/verify-help-support.ts            # migration'ları da transaction içinde uygular
 *   SKIP_MIGRATIONS=1 npx tsx scripts/verify-help-support.ts   # migration'lar zaten uygulandıysa
 *
 * SUPABASE_DB_URL .env.local'den okunur (bkz. scripts/load-env.ts).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { loadEnvLocal } from "./load-env";

loadEnvLocal();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, "..", "supabase", "migrations");

let pass = 0;
let fail = 0;
function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? " — " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("SUPABASE_DB_URL tanımlı değil.");
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const userA = randomUUID();
  const userB = randomUUID();
  const stamp = Date.now();

  async function asUser(uid: string) {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    await client.query("set local role authenticated");
  }
  async function asService() {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', true)");
    await client.query("set local role service_role");
  }
  /** Beklenen hatayı savepoint ile yakalar — transaction bozulmaz. */
  async function expectError(sql: string, params: unknown[] = []): Promise<string | null> {
    await client.query("savepoint sp");
    try {
      await client.query(sql, params);
      await client.query("release savepoint sp");
      return null;
    } catch (err) {
      await client.query("rollback to savepoint sp");
      return err instanceof Error ? err.message : String(err);
    }
  }

  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '5s'");

    if (!process.env.SKIP_MIGRATIONS) {
      for (const file of ["0061_help_center_and_support.sql", "0062_help_center_seed.sql"]) {
        await client.query(readFileSync(resolve(migrationsDir, file), "utf8"));
      }
      // İdempotentlik: ikinci kez çalıştırmak hata vermemeli.
      let idempotent = true;
      for (const file of ["0061_help_center_and_support.sql", "0062_help_center_seed.sql"]) {
        const e = await expectError(readFileSync(resolve(migrationsDir, file), "utf8"));
        if (e) {
          idempotent = false;
          console.log("   idempotentlik hatası:", file, e);
        }
      }
      report("Migration'lar uygulanıyor ve tekrar çalıştırılabiliyor (idempotent)", idempotent);
    }

    // Test kullanıcıları (transaction sonunda geri alınır).
    for (const [id, tag] of [[userA, "a"], [userB, "b"]] as const) {
      await client.query(
        `insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
         values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '{}'::jsonb, '{}'::jsonb, now(), now())`,
        [id, `help-test-${tag}-${stamp}@example.com`]
      );
    }

    // 1) Normal kullanıcı yayınlanmış makaleleri görebiliyor mu?
    await asUser(userA);
    const published = await client.query("select count(*)::int as n from public.help_articles");
    const cats = await client.query("select count(*)::int as n from public.help_categories");
    report("1. Kullanıcı yayınlanmış makaleleri görüyor", published.rows[0].n >= 20, `${published.rows[0].n} makale, ${cats.rows[0].n} kategori`);

    // Türkçe karakter duyarsız arama
    const s1 = await client.query("select slug from public.search_help_articles('SIFRE', 20)");
    const s2 = await client.query("select slug from public.search_help_articles('bütçe oluştur', 20)");
    const s3 = await client.query("select slug from public.search_help_articles('100%_', 20)");
    report(
      "   Arama Türkçe karakter duyarsız (SIFRE → şifre)",
      s1.rows.some((r) => r.slug === "verilerim-guvende-mi"),
      s1.rows.map((r) => r.slug).join(", ")
    );
    report("   Çok kelimeli arama (bütçe oluştur)", s2.rows[0]?.slug === "butce-nasil-olusturulur", s2.rows[0]?.slug);
    report("   LIKE joker karakterleri etkisiz", s3.rowCount === 0);

    // 2) Taslak/arşiv makale normal kullanıcıya görünmüyor mu?
    await asService();
    const cat = await client.query("select id from public.help_categories where slug = 'baslarken'");
    await client.query(
      `insert into public.help_articles (category_id, slug, title, summary, status, tags)
       values ($1, 'test-taslak-${stamp}', 'Gizli taslak zebra', 'Taslak özet', 'draft', array['zebra']),
              ($1, 'test-arsiv-${stamp}', 'Gizli arşiv zebra', 'Arşiv özet', 'archived', array['zebra'])`,
      [cat.rows[0].id]
    );
    const adminSees = await client.query("select count(*)::int as n from public.help_articles where slug like 'test-%'");
    await asUser(userA);
    const draftVisible = await client.query("select count(*)::int as n from public.help_articles where slug like 'test-%'");
    const draftSearch = await client.query("select count(*)::int as n from public.search_help_articles('zebra', 20)");
    report(
      "2. Taslak/arşiv makale kullanıcıya görünmüyor (select + arama)",
      adminSees.rows[0].n === 2 && draftVisible.rows[0].n === 0 && draftSearch.rows[0].n === 0,
      `admin:${adminSees.rows[0].n} kullanıcı:${draftVisible.rows[0].n} arama:${draftSearch.rows[0].n}`
    );
    const draftFeedback = await expectError(
      `insert into public.help_article_feedback (article_id, user_id, helpful)
       select id, $1, true from public.help_articles where slug = 'test-taslak-${stamp}'`,
      [userA]
    );
    // Kullanıcı taslağı göremediği için select boş döner → 0 satır eklenir (hata değil, etki yok).
    const fbCount = await client.query("select count(*)::int as n from public.help_article_feedback where user_id = $1", [userA]);
    report("   Taslak makaleye geri bildirim yazılamıyor", draftFeedback !== null || fbCount.rows[0].n === 0);

    // Geri bildirim: yayınlanmış makaleye ekle + güncelle (upsert)
    const art = await client.query("select id from public.help_articles where slug = 'parakip-nedir'");
    await client.query(
      `insert into public.help_article_feedback (article_id, user_id, helpful) values ($1, $2, false)
       on conflict (article_id, user_id) do update set helpful = excluded.helpful`,
      [art.rows[0].id, userA]
    );
    await client.query(
      `insert into public.help_article_feedback (article_id, user_id, helpful) values ($1, $2, true)
       on conflict (article_id, user_id) do update set helpful = excluded.helpful`,
      [art.rows[0].id, userA]
    );
    const fb = await client.query("select helpful from public.help_article_feedback where user_id = $1", [userA]);
    report("   Makale geri bildirimi (evet/hayır) kaydediliyor ve güncelleniyor", fb.rowCount === 1 && fb.rows[0].helpful === true);

    // 3) Kullanıcı destek talebi oluşturabiliyor mu? Öncelik/durum sistemde mi belirleniyor?
    const reqA = randomUUID();
    const t = await client.query(
      `insert into public.support_tickets (user_id, type, subject, description, status, priority, client_request_id, space_type)
       values ($1, 'payment', 'Havale onaylanmadı', 'Dün havale yaptım ama plan aktif olmadı.', 'closed', 'low', $2, 'home')
       returning id, status, priority, ticket_number`,
      [userA, reqA]
    );
    const ticketA = t.rows[0];
    report(
      "3. Kullanıcı destek talebi oluşturabiliyor; durum/öncelik sistem tarafından atanıyor",
      ticketA.status === "open" && ticketA.priority === "high",
      `#${ticketA.ticket_number} status=${ticketA.status} priority=${ticketA.priority} (gönderilen: closed/low)`
    );

    // 12) Aynı client_request_id ile ikinci kayıt (çift tıklama) engelleniyor mu?
    const dup = await expectError(
      `insert into public.support_tickets (user_id, type, subject, description, client_request_id)
       values ($1, 'bug', 'Tekrar', 'Çift tıklama denemesi', $2)`,
      [userA, reqA]
    );
    const countA = await client.query("select count(*)::int as n from public.support_tickets where user_id = $1", [userA]);
    report("12. Aynı istek kimliğiyle mükerrer talep oluşmuyor", dup !== null && /duplicate key|unique/i.test(dup) && countA.rows[0].n === 1);

    // Kullanıcı kendi talebini UPDATE edemez (durumu kendisi değiştiremez)
    const upd = await expectError("update public.support_tickets set status = 'resolved', priority = 'urgent' where id = $1", [ticketA.id]);
    const del = await expectError("delete from public.support_tickets where id = $1", [ticketA.id]);
    const after = await client.query("select status, priority from public.support_tickets where id = $1", [ticketA.id]);
    report(
      "   Kullanıcı talebi güncelleyemiyor/silemiyor",
      after.rows[0]?.status === "open" && after.rows[0]?.priority === "high",
      `update:${upd ? "reddedildi" : "etkisiz"} delete:${del ? "reddedildi" : "etkisiz"} durum=${after.rows[0]?.status}`
    );
    const anonRead = await (async () => {
      await client.query("reset role");
      await client.query("set local role anon");
      const r = await expectError("select count(*) from public.help_articles");
      await asUser(userA);
      return r;
    })();
    report("   Oturumsuz (anon) kullanıcı makaleleri okuyamıyor", anonRead !== null, anonRead ?? "okunabildi");

    // Başkası adına talep oluşturulamıyor
    await asUser(userB);
    const forge = await expectError(
      `insert into public.support_tickets (user_id, type, subject, description, client_request_id)
       values ($1, 'bug', 'Sahte', 'Başkası adına talep', $2)`,
      [userA, randomUUID()]
    );
    report("   Başka kullanıcı adına talep oluşturulamıyor", forge !== null && /row-level security/i.test(forge));

    // 4 & 9) Kullanıcı yalnızca kendi taleplerini görebiliyor mu?
    const bSees = await client.query("select count(*)::int as n from public.support_tickets where id = $1", [ticketA.id]);
    await asUser(userA);
    const aSees = await client.query("select count(*)::int as n from public.support_tickets where id = $1", [ticketA.id]);
    report(
      "4/9. Kullanıcı yalnızca kendi talebini görüyor; başkasınınki RLS ile gizli",
      aSees.rows[0].n === 1 && bSees.rows[0].n === 0,
      `sahibi:${aSees.rows[0].n} başkası:${bSees.rows[0].n}`
    );

    // 5) Kullanıcı destek mesajı gönderebiliyor mu?
    await client.query(
      `insert into public.support_messages (ticket_id, author_user_id, author_role, body, client_request_id)
       values ($1, $2, 'user', 'Dekont ekte değil ama referans kodu PRK-TEST.', $3)`,
      [ticketA.id, userA, randomUUID()]
    );
    const fakeAdmin = await expectError(
      `insert into public.support_messages (ticket_id, author_user_id, author_role, body)
       values ($1, $2, 'admin', 'Sahte admin mesajı')`,
      [ticketA.id, userA]
    );
    report("5. Kullanıcı mesaj gönderebiliyor; kendini admin gösteremiyor", fakeAdmin !== null);

    await asUser(userB);
    const bMsg = await expectError(
      `insert into public.support_messages (ticket_id, author_user_id, author_role, body)
       values ($1, $2, 'user', 'Başkasının talebine mesaj')`,
      [ticketA.id, userB]
    );
    report("   Başka kullanıcının talebine mesaj yazılamıyor", bMsg !== null && /row-level security/i.test(bMsg));

    // 6) Admin (service_role) talebi görebiliyor ve yanıtlayabiliyor mu?
    await asService();
    const adminTicket = await client.query("select count(*)::int as n from public.support_tickets where id = $1", [ticketA.id]);
    await client.query(
      `insert into public.support_messages (ticket_id, author_role, body) values ($1, 'admin', 'Merhaba, ödemeni kontrol ettik ve planını aktifleştirdik.')`,
      [ticketA.id]
    );
    await client.query(
      `insert into public.support_messages (ticket_id, author_role, body, is_internal) values ($1, 'admin', 'İÇ NOT: banka ekstresi 14:02', true)`,
      [ticketA.id]
    );
    await client.query("update public.support_tickets set status = 'answered', last_admin_reply_at = now() where id = $1", [ticketA.id]);
    report("6. Admin talebi görüyor ve yanıtlayabiliyor", adminTicket.rows[0].n === 1);

    // 7) Kullanıcı admin yanıtını görüyor, iç notu GÖRMÜYOR
    await asUser(userA);
    const msgs = await client.query("select author_role, is_internal, body from public.support_messages where ticket_id = $1 order by created_at", [ticketA.id]);
    const seesAdmin = msgs.rows.some((m) => m.author_role === "admin" && !m.is_internal);
    const seesInternal = msgs.rows.some((m) => m.is_internal);
    report("7. Kullanıcı admin yanıtını görüyor, iç notu görmüyor", seesAdmin && !seesInternal, `${msgs.rowCount} mesaj görünür`);

    // 8) Durum değişiyor mu? Kullanıcı yanıtı 'answered' → 'open' yapıyor mu? Olay kaydı var mı?
    const st1 = await client.query("select status from public.support_tickets where id = $1", [ticketA.id]);
    await client.query(
      `insert into public.support_messages (ticket_id, author_user_id, author_role, body) values ($1, $2, 'user', 'Teşekkürler, bir sorum daha var.')`,
      [ticketA.id, userA]
    );
    const st2 = await client.query("select status from public.support_tickets where id = $1", [ticketA.id]);
    await asService();
    await client.query("update public.support_tickets set status = 'closed' where id = $1", [ticketA.id]);
    const st3 = await client.query("select status, closed_at from public.support_tickets where id = $1", [ticketA.id]);
    const events = await client.query("select event, from_status, to_status from public.support_ticket_events where ticket_id = $1 order by created_at", [ticketA.id]);
    report(
      "8. Durum değişiyor (answered → kullanıcı yanıtıyla open → closed) ve olay kaydı tutuluyor",
      st1.rows[0].status === "answered" && st2.rows[0].status === "open" && st3.rows[0].status === "closed" && st3.rows[0].closed_at !== null,
      events.rows.map((e) => e.event + (e.to_status ? `:${e.to_status}` : "")).join(", ")
    );

    await asUser(userA);
    const closedMsg = await expectError(
      `insert into public.support_messages (ticket_id, author_user_id, author_role, body) values ($1, $2, 'user', 'Kapalı talebe mesaj')`,
      [ticketA.id, userA]
    );
    report("   Kapatılmış talebe mesaj yazılamıyor", closedMsg !== null);
    const evVisible = await expectError("select * from public.support_ticket_events");
    const evRows = evVisible === null ? await client.query("select count(*)::int as n from public.support_ticket_events") : null;
    report("   Olay kaydı (audit) kullanıcıya kapalı", evVisible !== null || evRows?.rows[0].n === 0);

    // 10) Ekran görüntüsü gizli saklanıyor mu? (bucket private + klasör izolasyonu)
    await asService();
    const bucket = await client.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'support-attachments'");
    const t2 = await (async () => {
      await asUser(userA);
      return client.query(
        `insert into public.support_tickets (user_id, type, subject, description, client_request_id)
         values ($1, 'bug', 'Ekran bozuk', 'Bütçeler ekranında grafik görünmüyor.', $2) returning id`,
        [userA, randomUUID()]
      );
    })();
    const ticket2 = t2.rows[0].id;
    const pathA = `${userA}/${randomUUID()}/shot.png`;
    const ownUpload = await expectError(
      `insert into storage.objects (bucket_id, name, owner, metadata) values ('support-attachments', $1, $2, '{"mimetype":"image/png","size":1000}'::jsonb)`,
      [pathA, userA]
    );
    const foreignUpload = await expectError(
      `insert into storage.objects (bucket_id, name, owner, metadata) values ('support-attachments', $1, $2, '{"mimetype":"image/png","size":1000}'::jsonb)`,
      [`${userB}/${randomUUID()}/x.png`, userA]
    );
    const attachOwn = await expectError(
      `insert into public.support_attachments (ticket_id, uploaded_by, storage_path, mime_type, size_bytes) values ($1, $2, $3, 'image/png', 1000)`,
      [ticket2, userA, pathA]
    );
    const attachForeignPath = await expectError(
      `insert into public.support_attachments (ticket_id, uploaded_by, storage_path, mime_type, size_bytes) values ($1, $2, $3, 'image/png', 1000)`,
      [ticket2, userA, `${userB}/x/y.png`]
    );
    await asUser(userB);
    const bObj = await client.query("select count(*)::int as n from storage.objects where name = $1", [pathA]);
    const bAtt = await client.query("select count(*)::int as n from public.support_attachments where ticket_id = $1", [ticket2]);
    report(
      "10. Ekran görüntüsü gizli: bucket private, yalnızca kendi klasörü, başkası göremiyor",
      bucket.rows[0]?.public === false &&
        ownUpload === null &&
        foreignUpload !== null &&
        attachOwn === null &&
        attachForeignPath !== null &&
        bObj.rows[0].n === 0 &&
        bAtt.rows[0].n === 0,
      `public=${bucket.rows[0]?.public} limit=${bucket.rows[0]?.file_size_limit} kendi:${ownUpload === null ? "ok" : ownUpload} başka klasör:${foreignUpload ? "engellendi" : "İZİN VERİLDİ"} B görür:${bObj.rows[0].n}/${bAtt.rows[0].n}`
    );

    // Finansal izolasyon: destek tabloları finansal tablolara referans vermiyor
    await asService();
    const fks = await client.query(
      `select distinct ccu.table_name from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
       where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
         and tc.table_name in ('support_tickets','support_messages','support_attachments','support_ticket_events','help_articles','help_article_feedback')`
    );
    const refs = fks.rows.map((r) => r.table_name);
    const financial = ["books", "transactions", "transaction_entries", "accounts", "spaces", "debts", "budgets", "holdings"];
    report("   Destek tabloları hiçbir finansal tabloya bağlı değil", !refs.some((r) => financial.includes(r)), refs.join(", "));
  } catch (err) {
    report("Beklenmeyen hata", false, err instanceof Error ? err.message : String(err));
  } finally {
    await client.query("rollback").catch(() => undefined);
    await client.end();
  }

  console.log(`\n${pass} geçti, ${fail} başarısız. (Tüm değişiklikler ROLLBACK edildi.)`);
  if (fail > 0) process.exitCode = 1;
}

main();
