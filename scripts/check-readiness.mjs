const url = new URL("/health/ready", process.env.BACKEND_URL);
if (url.protocol !== "https:") throw Error("HTTPS required");
let ready = false;
for (let i = 0; i < 60; i++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = response.ok ? await response.json() : {};
    if (
      body.status === "ready" &&
      body.revision === process.env.EXPECTED_REVISION
    ) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 5000));
}
if (!ready)
  throw Error("Backend readiness failed; frontend will not be promoted");
console.log("Backend is ready");
