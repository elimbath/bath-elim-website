// Cloudflare Worker entry point.
// Serves the built site (_site) as static assets, and routes /api/* to the
// same handlers in functions/api/ (written in Cloudflare Pages Functions style,
// so the project also still works if deployed as a Pages project).
import * as auth from "./functions/api/auth.js";
import * as callback from "./functions/api/callback.js";
import * as form from "./functions/api/[form].js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/\/+$/, "").split("/"); // ["", "api", "x"]

    if (parts[1] === "api" && parts.length === 3) {
      const name = parts[2];
      const context = { request, env, params: { form: name }, waitUntil: ctx.waitUntil.bind(ctx) };
      if (name === "auth" && request.method === "GET") return auth.onRequestGet(context);
      if (name === "callback" && request.method === "GET") return callback.onRequestGet(context);
      if (request.method === "POST") return form.onRequestPost(context);
      return new Response("Not found", { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
