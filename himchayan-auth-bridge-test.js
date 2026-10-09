const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "https://himchayan.in",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Cache-Control": "no-store"
    }
  });

const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 }, key, 256
  );
  return `pbkdf2$310000$${b64(salt)}$${b64(bits)}`;
}

async function verifyPassword(password, stored) {
  const [alg, rounds, salt, expected] = String(stored || "").split("$");
  if (alg !== "pbkdf2" || Number(rounds) !== 310000 || !salt || !expected) return false;
  const actual = await hashPassword(password, unb64(salt));
  return actual === stored;
}

async function createSession(env, user) {
  const access = crypto.randomUUID() + crypto.randomUUID();
  const refresh = crypto.randomUUID() + crypto.randomUUID();
  await env.SESSIONS.put("access:" + access, JSON.stringify({ id: user.id }), { expirationTtl: 900 });
  await env.SESSIONS.put("refresh:" + refresh, JSON.stringify({ id: user.id }), { expirationTtl: 2592000 });
  return { access_token: access, refresh_token: refresh, expires_in: 900, user };
}

async function getUser(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const data = await env.SESSIONS.get("access:" + token, "json");
  if (!data) return null;
  return await env.DB.prepare(
    "SELECT id,email,full_name,role FROM auth_users WHERE id=?"
  ).bind(data.id).first();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: {
      "Access-Control-Allow-Origin": "https://himchayan.in",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }});

    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "cloudflare-auth" });
    if (request.method !== "POST" && url.pathname !== "/auth/user") return json({ error: "Not found" }, 404);

    try {
      const body = request.method === "POST" ? await request.json() : {};
      const email = String(body.email || "").trim().toLowerCase();

      if (url.pathname === "/auth/signup") {
        if (!email || String(body.password || "").length < 10) return json({ error: "Valid email and password of at least 10 characters required" }, 400);
        const exists = await env.DB.prepare("SELECT id FROM auth_users WHERE lower(email)=?").bind(email).first();
        if (exists) return json({ error: "Account already exists" }, 409);
        const id = crypto.randomUUID();
        const password_hash = await hashPassword(String(body.password));
        await env.DB.prepare(
          "INSERT INTO auth_users (id,email,password_hash,created_at,auth_source) VALUES (?,?,?,datetime('now'),'cloudflare')"
        ).bind(id, email, password_hash).run();
        return json(await createSession(env, { id, email, role: "user" }), 201);
      }

      if (url.pathname === "/auth/login") {
        const row = await env.DB.prepare(
          "SELECT id,email,password_hash,full_name,role FROM auth_users WHERE lower(email)=?"
        ).bind(email).first();
        if (!row || !(await verifyPassword(String(body.password || ""), row.password_hash))) {
          return json({ error: "Invalid email or password" }, 401);
        }
        return json(await createSession(env, row));
      }

      if (url.pathname === "/auth/user") {
        const user = await getUser(request, env);
        return user ? json({ user }) : json({ error: "Invalid session" }, 401);
      }

      if (url.pathname === "/auth/refresh") {
        const token = String(body.refresh_token || "");
        const session = await env.SESSIONS.get("refresh:" + token, "json");
        if (!session) return json({ error: "Session expired" }, 401);
        const user = await env.DB.prepare(
          "SELECT id,email,full_name,role FROM auth_users WHERE id=?"
        ).bind(session.id).first();
        if (!user) return json({ error: "Account not found" }, 401);
        await env.SESSIONS.delete("refresh:" + token);
        return json(await createSession(env, user));
      }

      if (url.pathname === "/auth/logout") {
        const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (token) await env.SESSIONS.delete("access:" + token);
        if (body.refresh_token) await env.SESSIONS.delete("refresh:" + body.refresh_token);
        return json({ ok: true });
      }

      return json({ error: "Not found" }, 404);
    } catch {
      return json({ error: "Authentication service error" }, 500);
    }
  }
};
