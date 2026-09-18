/**
 * POST /api/send-email
 * Protected by ZS_MASTER_KEY.
 *
 * body: {
 *   to:          string          — recipient email
 *   type:        'market'|'dist' — client type
 *   storeName:   string
 *   username:    string
 *   password:    string
 *   supportPhone?: string        — WhatsApp support number (digits only)
 * }
 *
 * Requires GMAIL_APP_PASSWORD env var (Netlify Site Settings → Env vars).
 * When not set, returns previewHtml so admin can copy the content manually.
 */
import nodemailer from 'nodemailer'

const MASTER_KEY    = process.env.ZS_MASTER_KEY    || 'zatende2026master'
const FROM_EMAIL    = 'zatendeapi@gmail.com'
const GMAIL_PASS    = process.env.GMAIL_APP_PASSWORD || ''
const SUPPORT_PHONE = process.env.SUPPORT_WHATSAPP  || '5500000000000'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

/* ── HTML email template ─────────────────────────────────── */
function buildHtml({ type, storeName, username, password, supportPhone }) {
  const isMkt      = type === 'market'
  const accentColor = isMkt ? '#f97316' : '#10b981'
  const url        = isMkt
    ? 'https://zatendestock.netlify.app'
    : 'https://zatendestock.netlify.app/fornecedor'
  const portal     = isMkt ? 'PDV – Portal do Mercado' : 'Portal do Distribuidor'
  const intro      = isMkt
    ? 'Seu sistema de ponto de venda está pronto. Acesse abaixo com suas credenciais e comece a vender!'
    : 'Seu portal de distribuição está pronto. Acesse abaixo com suas credenciais e comece a enviar ofertas para seus mercados!'
  const steps = isMkt
    ? ['Abra o link abaixo no computador ou celular', 'Faça login com usuário e senha', 'Configure o nome da loja em Configurações', 'Cadastre seus produtos e comece a vender!']
    : ['Abra o link abaixo no computador ou celular', 'Faça login com usuário e senha', 'Configure o perfil da sua distribuidora', 'Cadastre seus mercados e envie ofertas!']

  const phone = supportPhone || SUPPORT_PHONE
  const zapLink = `https://wa.me/${phone.replace(/\D/g, '')}?text=Ol%C3%A1!+Preciso+de+ajuda+com+o+ZatendeStock`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Bem-vindo ao ZatendeStock</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:36px 40px;text-align:center">
        <div style="color:${accentColor};font-size:13px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px">ZatendeStock</div>
        <div style="color:#ffffff;font-size:26px;font-weight:900;margin:0">Acesso criado com sucesso! 🎉</div>
        <div style="color:#94a3b8;font-size:14px;margin-top:8px">${portal}</div>
      </td></tr>

      <!-- Intro -->
      <tr><td style="padding:32px 40px 0">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0">
          Olá, <strong>${storeName}</strong>!
        </p>
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:12px 0 0">
          ${intro}
        </p>
      </td></tr>

      <!-- Credentials box -->
      <tr><td style="padding:24px 40px">
        <div style="background:#f8fafc;border:2px solid ${accentColor}30;border-radius:16px;padding:24px">
          <div style="font-size:11px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px">Suas credenciais de acesso</div>
          <table width="100%">
            <tr>
              <td style="padding:8px 0">
                <div style="color:#64748b;font-size:12px;font-weight:700;margin-bottom:2px">USUÁRIO</div>
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-family:monospace;font-size:16px;color:#1e293b;font-weight:700">${username}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0">
                <div style="color:#64748b;font-size:12px;font-weight:700;margin-bottom:2px">SENHA</div>
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-family:monospace;font-size:16px;color:#1e293b;font-weight:700">${password}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0">
                <div style="color:#64748b;font-size:12px;font-weight:700;margin-bottom:2px">LINK DE ACESSO</div>
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-family:monospace;font-size:13px;color:${accentColor}">${url}</div>
              </td>
            </tr>
          </table>
        </div>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:0 40px 24px;text-align:center">
        <a href="${url}" style="display:inline-block;background:${accentColor};color:#ffffff;font-weight:900;font-size:15px;padding:16px 36px;border-radius:14px;text-decoration:none;box-shadow:0 8px 20px ${accentColor}40">
          Acessar agora →
        </a>
      </td></tr>

      <!-- Steps -->
      <tr><td style="padding:0 40px 24px">
        <div style="font-size:11px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px">Primeiros passos</div>
        ${steps.map((s, i) => `
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div style="width:24px;height:24px;border-radius:8px;background:${accentColor};color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:24px;text-align:center">${i + 1}</div>
          <div style="color:#374151;font-size:14px;line-height:1.5;padding-top:3px">${s}</div>
        </div>`).join('')}
      </td></tr>

      <!-- Support -->
      <tr><td style="padding:0 40px 32px">
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:14px;padding:20px;text-align:center">
          <div style="color:#166534;font-size:14px;font-weight:700;margin-bottom:8px">💬 Precisa de ajuda?</div>
          <div style="color:#166534;font-size:13px;margin-bottom:12px">Nossa equipe está disponível pelo WhatsApp</div>
          <a href="${zapLink}" style="display:inline-block;background:#22c55e;color:#ffffff;font-weight:900;font-size:13px;padding:10px 24px;border-radius:10px;text-decoration:none">
            Falar no WhatsApp
          </a>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0">
        <div style="color:#94a3b8;font-size:12px">ZatendeStock · Sistema profissional para mercados e distribuidoras</div>
        <div style="color:#cbd5e1;font-size:11px;margin-top:4px">Este email foi enviado automaticamente. Não responda a este endereço.</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

/* ── plain text fallback ─────────────────────────────────── */
function buildText({ type, storeName, username, password }) {
  const url = type === 'market'
    ? 'https://zatendestock.netlify.app'
    : 'https://zatendestock.netlify.app/fornecedor'
  return `Olá, ${storeName}!

Seu acesso ao ZatendeStock foi criado.

Usuário: ${username}
Senha:   ${password}
Link:    ${url}

Qualquer dúvida, entre em contato com o suporte.

ZatendeStock`
}

/* ── handler ─────────────────────────────────────────────── */
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS })
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405 })

  const mk = new URL(req.url).searchParams.get('mk')
  if (mk !== MASTER_KEY)
    return new Response(JSON.stringify({ ok: false, error: 'Não autorizado' }), { status: 401, headers: CORS })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400, headers: CORS })
  }

  const { to, type, storeName, username, password, supportPhone } = body
  if (!to || !type || !storeName || !username || !password)
    return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatórios: to, type, storeName, username, password' }), { status: 400, headers: CORS })

  const html    = buildHtml({ type, storeName, username, password, supportPhone })
  const text    = buildText({ type, storeName, username, password })
  const subject = type === 'market'
    ? `✅ Seu acesso ao ZatendeStock PDV está pronto — ${storeName}`
    : `✅ Portal do Distribuidor ZatendeStock — Acesso criado para ${storeName}`

  // ── Try to send via Gmail SMTP ──────────────────────────
  if (GMAIL_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host:   'smtp.gmail.com',
        port:   465,
        secure: true,
        auth:   { user: FROM_EMAIL, pass: GMAIL_PASS },
      })
      await transporter.sendMail({ from: `"ZatendeStock" <${FROM_EMAIL}>`, to, subject, text, html })
      return new Response(JSON.stringify({ ok: true, sent: true }), { headers: CORS })
    } catch (err) {
      // Fall through to previewHtml — don't hard-fail
      console.error('SMTP error:', err.message)
      return new Response(JSON.stringify({ ok: false, sent: false, error: err.message, previewHtml: html }), { headers: CORS })
    }
  }

  // ── No SMTP configured — return preview so admin can copy ──
  return new Response(JSON.stringify({
    ok: true, sent: false,
    warning: 'GMAIL_APP_PASSWORD não configurada. Configure em Netlify → Site Settings → Environment Variables.',
    previewHtml: html,
  }), { headers: CORS })
}

export const config = { path: '/api/send-email' }
