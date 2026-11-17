// Step 2 of the CMS login: GitHub sends the editor back here; swap the code for a token
// and hand it to the CMS window that opened the login popup.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = /(?:^|;\s*)oauth_state=([^;]+)/.exec(request.headers.get("Cookie") || "")?.[1];

  let message;
  if (!code || !state || state !== cookieState) {
    message = "error:" + JSON.stringify({ error: "Login failed: invalid state. Please try again." });
  } else {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "bath-elim-cms" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
    });
    const data = await res.json();
    message = data.access_token
      ? "success:" + JSON.stringify({ token: data.access_token, provider: "github" })
      : "error:" + JSON.stringify({ error: data.error_description || "Login failed." });
  }

  const origin = JSON.stringify(url.origin);
  const payload = JSON.stringify("authorization:github:" + message);
  const html = `<!doctype html><meta charset="utf-8"><title>Signing in…</title><p>Signing in…</p>
<script>
  (function () {
    function receive(e) {
      if (e.origin !== ${origin}) return;
      window.opener.postMessage(${payload}, e.origin);
      window.removeEventListener("message", receive);
    }
    window.addEventListener("message", receive);
    window.opener.postMessage("authorizing:github", ${origin});
  })();
</script>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": "oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
