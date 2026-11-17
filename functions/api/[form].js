// Handles the website's forms: POST /api/contact (footer) and /api/hire (venue hire enquiry).
// Sends each submission by email using Resend (https://resend.com — free for up to 3,000 emails/month).
// Env vars (Cloudflare Pages → Settings → Variables):
//   RESEND_API_KEY   – API key from Resend (store as a secret)
//   FORM_TO_EMAIL    – where submissions go, e.g. office@elimbath.org
//   FORM_FROM_EMAIL  – a sender on a domain verified in Resend, e.g. "Bath Elim Website <website@elimbath.org>"
const FORMS = {
  contact: "Website contact form",
  hire: "Venue hire enquiry",
};

export async function onRequestPost({ request, env, params }) {
  const subject = FORMS[params.form];
  if (!subject) return new Response("Not found", { status: 404 });

  const data = await request.formData();
  if (data.get("website")) return new Response("OK"); // honeypot filled in → bot, pretend success

  const fields = {};
  for (const [key, value] of data.entries()) {
    if (key === "website" || typeof value !== "string") continue;
    fields[key] = fields[key] ? `${fields[key]}, ${value}` : value;
  }
  if (!Object.values(fields).some((v) => v.trim())) return new Response("Empty form", { status: 400 });

  if (!env.RESEND_API_KEY || !env.FORM_TO_EMAIL || !env.FORM_FROM_EMAIL) {
    return new Response("Form email is not configured", { status: 503 });
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const rows = Object.entries(fields)
    .map(([k, v]) => `<tr><th align="left" valign="top" style="padding:4px 12px 4px 0">${esc(k)}</th><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join("");
  const replyTo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.email || "") ? fields.email : undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.FORM_FROM_EMAIL,
      to: env.FORM_TO_EMAIL.split(",").map((s) => s.trim()),
      reply_to: replyTo,
      subject: `${subject}${fields.name ? " from " + fields.name : ""}`,
      html: `<h2>${esc(subject)}</h2><table>${rows}</table>`,
    }),
  });
  if (!res.ok) return new Response("Could not send", { status: 502 });
  return new Response("OK");
}
