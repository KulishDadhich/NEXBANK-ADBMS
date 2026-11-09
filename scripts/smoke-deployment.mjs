import "./validate-deployment-url.mjs";
const base = process.env.DEPLOYMENT_URL,
  headers = {};
if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
  headers["x-vercel-protection-bypass"] =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
for (const path of ["/", "/app/accounts", "/app/transfer"]) {
  const r = await fetch(base + path, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok || !(await r.text()).includes('<div id="root">'))
    throw Error("Frontend route failed: " + path);
}
const api = await fetch(base + "/api/accounts", {
  headers,
  signal: AbortSignal.timeout(15000),
});
if (api.status !== 401) throw Error("Protected API proxy did not return 401");
const result = await api.json();
if (result.error !== "Sign in required") throw Error("Unexpected API response");
console.log("Staged frontend routes and API proxy passed smoke checks");
