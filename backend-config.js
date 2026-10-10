/* Supabase is retained for legacy Auth/session/email. Business APIs use Cloudflare Workers. */
const SUPABASE_URL = "https://ugfimbafjqajpogatvld.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aIb1saXmG-6vbXcFi2E__w_6eDrGn4r";
var supabaseClient;
if (window.supabase && typeof window.supabase.createClient === "function") {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
window.supabaseClient = supabaseClient;

window.HIMCHAYAN_LEARNING_API = "https://himchayan-learning-api.pmindia.workers.dev";
window.HIMCHAYAN_PAYMENT_API = "https://himchayan-payment.pmindia.workers.dev";
window.HIMCHAYAN_RESOURCE_API = "https://himchayan-resource-gateway.pmindia.workers.dev";

/*
 * Prefer the Cloudflare Auth Bridge session used by the current login page.
 * Keep the old Supabase token as a fallback; retry it only if the Worker
 * rejects the Cloudflare token with HTTP 401.
 */
window.himchayanApiRequest = async function(baseUrl, action, payload = {}) {
  const tokens = [];
  try {
    const token = localStorage.getItem("himchayan_auth_access_token") || "";
    if (token) tokens.push(token);
  } catch (_) {}

  try {
    const client = window.supabaseClient;
    if (client?.auth?.getSession) {
      const { data, error } = await client.auth.getSession();
      const token = !error ? (data?.session?.access_token || "") : "";
      if (token && !tokens.includes(token)) tokens.push(token);
    }
  } catch (_) {}

  if (!tokens.length) tokens.push("");

  for (let i = 0; i < tokens.length; i++) {
    const headers = { "Accept": "application/json", "Content-Type": "application/json" };
    if (tokens[i]) headers.Authorization = "Bearer " + tokens[i];
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({ ...payload, action })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && i < tokens.length - 1) continue;
      return {
        data,
        error: response.ok ? null : new Error(data?.error || ("API HTTP " + response.status))
      };
    } catch (error) {
      return { data: null, error };
    }
  }
  return { data: null, error: new Error("Authentication failed") };
};

window.himchayanPaymentRequest = (action, payload = {}) =>
  window.himchayanApiRequest(window.HIMCHAYAN_PAYMENT_API, action, payload);
window.himchayanResourceRequest = (action, payload = {}) =>
  window.himchayanApiRequest(window.HIMCHAYAN_RESOURCE_API, action, payload);
