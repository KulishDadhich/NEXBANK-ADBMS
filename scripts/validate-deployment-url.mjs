const value = process.env.DEPLOYMENT_URL || "",
  url = new URL(value);
if (
  url.protocol !== "https:" ||
  url.origin !== value ||
  !url.hostname.endsWith(".vercel.app")
)
  throw Error("Unexpected deployment URL");
