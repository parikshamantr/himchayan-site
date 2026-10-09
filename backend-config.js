/* Supabase is retained only for Auth/session/email. Business API requests use Cloudflare Workers. */
const SUPABASE_URL = "https://ugfimbafjqajpogatvld.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aIb1saXm-6vbXcFi2E__w_6eDrGn4r";
var supabaseClient;
if (window.supabase && typeof window.supabase.createClient === "function") {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
window.supabaseClient = supabaseClient;

window.HIMCHAYAN_LEARNING_API = "https://himchayan-learning-api.pmindia.workers.dev";
window.HIMCHAYAN_PAYMENT_API = "https://himchayan-payment.pmindia.workers.dev";
window.HIMCHAYAN_RESOURCE_API = "https://himchayan-resource-gateway.pmindia.workers.dev";

window.himchayanApiRequest = async function(baseUrl, action, payload = {}) {
  let token = "";
  try {
    const client = window.supabaseClient;
    if (client?.auth?.getSession) {
      const { data, error } = await client.auth.getSession();
      if (!error) token = data?.session?.access_token || "";
    }
  } catch (_) {}
  try {
    if (!token) token = localStorage.getItem("himchayan_auth_access_token") || "";
  } catch (_) {}

  const headers = { "Accept": "application/json", "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({ ...payload, action })
    });
    const data = await response.json().catch(() => ({}));
    return { data, error: response.ok ? null : new Error(data?.error || ("API HTTP " + response.status)) };
  } catch (error) {
    return { data: null, error };
  }
};
window.himchayanPaymentRequest = (action, payload = {}) =>
  window.himchayanApiRequest(window.HIMCHAYAN_PAYMENT_API, action, payload);
window.himchayanResourceRequest = (action, payload = {}) =>
  window.himchayanApiRequest(window.HIMCHAYAN_RESOURCE_API, action, payload);
