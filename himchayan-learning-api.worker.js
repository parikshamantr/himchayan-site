/* HimChayan Learning API v1
   Uses the existing himchayan-core-migration D1 database.
   No R2 dependency in this version.
   Existing production Admin Panels are untouched.
*/

const JSON_HEADERS = {
  "content-type": "application/json; charset=UTF-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function id(prefix = "hc") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function bodyOf(request) {
  return request.json().catch(() => ({}));
}

async function isAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;

  // Staged auth bridge: the existing auth worker remains the identity source.
  const authApi = env.AUTH_API || "https://himchayan-auth-bridge-test.pmindia.workers.dev";
  try {
    const r = await fetch(`${authApi}/auth/user`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return false;
    const u = await r.json();
    const userId = u?.user?.id || u?.id || u?.data?.user?.id;
    if (!userId) return false;
    const row = await env.DB.prepare(
      "SELECT id, role, is_active FROM admin_users WHERE id = ? LIMIT 1"
    ).bind(userId).first();
    return !!row && Number(row.is_active ?? 1) === 1;
  } catch {
    return false;
  }
}

async function requireAdmin(request, env) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Admin access required" }, 403);
  return null;
}

async function query(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).all();
}

async function handle(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/health") {
    const r = await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ ok: !!r?.ok, service: "himchayan-learning-api", database: "connected" });
  }

  if (path === "/api/admin/dashboard" && request.method === "GET") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const [students, resources, pdfs, notes, mocks, questions, free, paid, attempts, sales] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) c FROM auth_users").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_content_items WHERE active=1").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_content_items WHERE content_type='PDF' AND active=1").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_content_items WHERE content_type='NOTES' AND active=1").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_mocks WHERE active=1").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_questions WHERE active=1").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_content_items WHERE access_type='FREE' AND active=1").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_content_items WHERE access_type='PAID' AND active=1").first(),
      env.DB.prepare("SELECT COUNT(*) c FROM hc_mock_attempts WHERE status IN ('SUBMITTED','AUTO_SUBMITTED')").first(),
      env.DB.prepare("SELECT COALESCE(SUM(amount),0) total FROM hc_content_orders WHERE status='PAID'").first()
    ]);
    return json({ ok:true, stats:{
      totalStudents:Number(students?.c||0), totalResources:Number(resources?.c||0), totalPdfs:Number(pdfs?.c||0),
      totalNotes:Number(notes?.c||0), totalMocks:Number(mocks?.c||0), totalQuizQuestions:Number(questions?.c||0),
      freeContent:Number(free?.c||0), paidContent:Number(paid?.c||0), mockAttempts:Number(attempts?.c||0),
      totalSales:Number(sales?.total||0)
    }});
  }


  // Public homepage Daily Updates ticker (uses existing content table; no schema/R2 changes).
  if (path === "/api/daily-updates" && request.method === "GET") {
    const rows = await query(env, "SELECT id,title,external_url,display_order,created_at FROM hc_content_items WHERE content_type='DAILY_UPDATE' AND active=1 AND published=1 ORDER BY display_order,created_at DESC LIMIT 30");
    return json({ok:true,data:rows.results});
  }
  if (path === "/api/admin/daily-updates" && request.method === "GET") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const rows = await query(env, "SELECT id,title,external_url,display_order,published,active FROM hc_content_items WHERE content_type='DAILY_UPDATE' ORDER BY display_order,title");
    return json({ok:true,data:rows.results});
  }
  if (path === "/api/admin/daily-updates" && request.method === "POST") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const b = await bodyOf(request); const title = String(b.title || "").trim();
    if (b.action === "delete") {
      if (!b.id) return json({ok:false,error:"Update id required"},400);
      await env.DB.prepare("UPDATE hc_content_items SET active=0,published=0 WHERE id=? AND content_type='DAILY_UPDATE'").bind(String(b.id)).run();
      return json({ok:true,deleted:true});
    }
    if (!title) return json({ok:false,error:"Headline required"},400);
    const externalUrl = String(b.external_url || "").trim() || null;
    const order = Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : 0;
    if (b.id) {
      await env.DB.prepare("UPDATE hc_content_items SET title=?,external_url=?,display_order=?,published=?,active=? WHERE id=? AND content_type='DAILY_UPDATE'")
        .bind(title,externalUrl,order,b.published===false?0:1,b.active===false?0:1,String(b.id)).run();
      return json({ok:true,id:String(b.id),updated:true});
    }
    const idv=id("daily");
    await env.DB.prepare("INSERT INTO hc_content_items (id,exam_name,content_type,title,external_url,access_type,allow_view,allow_download,published,active,display_order) VALUES(?,NULL,'DAILY_UPDATE',?,?, 'FREE',1,0,?,?,?)")
      .bind(idv,title,externalUrl,b.published===false?0:1,b.active===false?0:1,order).run();
    return json({ok:true,id:idv},201);
  }

  if (path === "/api/admin/categories" && request.method === "GET") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    return json({ ok:true, data:(await query(env,"SELECT * FROM hc_exam_categories ORDER BY display_order,name")).results });
  }

  if (path === "/api/admin/categories" && request.method === "POST") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const b = await bodyOf(request);
    const row = { id:id("cat"), name:String(b.name||"").trim(), slug:String(b.slug||b.name||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") };
    if (!row.name || !row.slug) return json({ok:false,error:"name required"},400);
    await env.DB.prepare("INSERT INTO hc_exam_categories(id,name,slug,icon,description,display_order,active) VALUES(?,?,?,?,?,?,?)")
      .bind(row.id,row.name,row.slug,b.icon||null,b.description||null,Number(b.display_order||0),b.active===false?0:1).run();
    return json({ok:true,id:row.id},201);
  }

  if (path === "/api/admin/content" && request.method === "GET") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const q = url.searchParams.get("q") || "";
    const rows = await query(env, `SELECT * FROM hc_content_items WHERE (?='' OR title LIKE ? OR exam_name LIKE ?) ORDER BY display_order,title`, [q,`%${q}%`,`%${q}%`]);
    return json({ok:true,data:rows.results});
  }

  if (path === "/api/admin/content" && request.method === "POST") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const b = await bodyOf(request);
    const idv=id("content");
    await env.DB.prepare(`INSERT INTO hc_content_items
      (id,category_id,subject_id,exam_name,content_type,title,description,file_type,storage_key,external_url,access_type,price,allow_view,allow_download,published,active,display_order,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(idv,b.category_id||null,b.subject_id||null,b.exam_name||null,b.content_type||"PDF",b.title||"",b.description||null,b.file_type||"PDF",b.storage_key||null,b.external_url||null,b.access_type||"FREE",Number(b.price||0),b.allow_view===false?0:1,b.allow_download?1:0,b.published?1:0,b.active===false?0:1,Number(b.display_order||0),b.created_by||null).run();
    return json({ok:true,id:idv},201);
  }

  if (path === "/api/admin/mocks" && request.method === "GET") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const rows=await query(env,"SELECT m.*,t.name template_name FROM hc_mocks m LEFT JOIN hc_mock_templates t ON t.id=m.template_id ORDER BY m.display_order,m.created_at DESC");
    return json({ok:true,data:rows.results});
  }

  if (path === "/api/admin/mocks" && request.method === "POST") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const b=await bodyOf(request); const idv=id("mock");
    await env.DB.prepare(`INSERT INTO hc_mocks
      (id,category_id,subject_id,exam_name,mock_type,title,description,template_id,access_type,price,total_questions,timer_minutes,negative_marking,language_mode,shuffle_questions,result_enabled,answer_key_enabled,review_enabled,attempt_limit,privacy_protection,published,active,display_order,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(idv,b.category_id||null,b.subject_id||null,b.exam_name||null,b.mock_type||"COMPETITIVE",b.title||"",b.description||null,b.template_id||null,b.access_type||"FREE",Number(b.price||0),Number(b.total_questions||0),Number(b.timer_minutes||60),Number(b.negative_marking||0),b.language_mode||"BOTH",b.shuffle_questions===false?0:1,b.result_enabled===false?0:1,b.answer_key_enabled===false?0:1,b.review_enabled===false?0:1,b.attempt_limit?Number(b.attempt_limit):null,b.privacy_protection===false?0:1,b.published?1:0,b.active===false?0:1,Number(b.display_order||0),b.created_by||null).run();
    return json({ok:true,id:idv},201);
  }

  if (path === "/api/admin/questions" && request.method === "POST") {
    const denied = await requireAdmin(request, env); if (denied) return denied;
    const b=await bodyOf(request); const qid=id("q");
    await env.DB.prepare(`INSERT INTO hc_questions(id,question_type,question_hi,question_en,explanation_hi,explanation_en,difficulty,source_type,correct_option_key,active,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(qid,b.question_type||"MCQ",b.question_hi||null,b.question_en||null,b.explanation_hi||null,b.explanation_en||null,b.difficulty||null,b.source_type||"MANUAL",b.correct_option_key||null,b.active===false?0:1,b.created_by||null).run();
    const opts=Array.isArray(b.options)?b.options:[];
    for(let i=0;i<opts.length;i++){
      const o=opts[i];
      await env.DB.prepare("INSERT INTO hc_question_options(id,question_id,option_key,option_hi,option_en,display_order) VALUES(?,?,?,?,?,?)")
        .bind(id("opt"),qid,o.key||String.fromCharCode(65+i),o.hi||null,o.en||null,i).run();
    }
    return json({ok:true,id:qid},201);
  }

  return json({ok:false,error:"Not found"},404);
}

export default { fetch: handle };
