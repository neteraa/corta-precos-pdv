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
 * Uses Resend API (resend.com) — free 3000 emails/month.
 * Requires RESEND_API_KEY env var (Netlify Site Settings → Env vars).
 * Without it: returns previewHtml so admin can copy manually.
 *
 * Setup (2 minutos):
 *   1. Criar conta grátis em resend.com
 *   2. API Keys → Create API Key → copiar
 *   3. Netlify → Site config → Env vars → RESEND_API_KEY = re_xxxx
 *   4. Trigger redeploy
 */

const MASTER_KEY    = process.env.ZS_MASTER_KEY    || 'zatende2026master'
const RESEND_KEY    = process.env.RESEND_API_KEY   || ''
const FROM_EMAIL    = process.env.FROM_EMAIL        || 'ZatendeStock <onboarding@resend.dev>'
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL       || 'agn.girardi@gmail.com'
const SUPPORT_PHONE = process.env.SUPPORT_WHATSAPP  || '5511985950956'

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
  return `Olá, ${storeName}!\n\nSeu acesso ao ZatendeStock foi criado.\n\nUsuário: ${username}\nSenha:   ${password}\nLink:    ${url}\n\nZatendeStock`
}

/* ── admin notify email (used when domain not verified) ──── */
function buildAdminNotify({ clientEmail, type, storeName, username, password }) {
  const clientHtml = buildHtml({ type, storeName, username, password })
  const label = type === 'market' ? 'Mercado' : 'Distribuidor'
  const mailtoBody = encodeURIComponent(
    `Olá, ${storeName}!\n\nSeu acesso ao ZatendeStock foi criado.\n\nUsuário: ${username}\nSenha: ${password}\nLink: ${type === 'market' ? 'https://zatendestock.netlify.app' : 'https://zatendestock.netlify.app/fornecedor'}`
  )
  const mailtoLink = `mailto:${clientEmail}?subject=${encodeURIComponent(`✅ Seu acesso ao ZatendeStock está pronto — ${storeName}`)}&body=${mailtoBody}`

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Novo acesso criado</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

  <!-- Admin header -->
  <tr><td style="background:#1e293b;border-radius:16px 16px 0 0;padding:20px 28px">
    <div style="color:#f97316;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">ZatendeStock · Notificação interna</div>
    <div style="color:#f1f5f9;font-size:20px;font-weight:900">🆕 Novo ${label} cadastrado</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:4px">Envie o acesso abaixo para o cliente</div>
  </td></tr>

  <!-- Client email target -->
  <tr><td style="background:#0f172a;padding:16px 28px;border-bottom:1px solid #1e293b">
    <div style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:6px">Destino do email</div>
    <div style="display:flex;align-items:center;gap:12px">
      <span style="color:#f1f5f9;font-size:15px;font-weight:700">${clientEmail || '(sem email cadastrado)'}</span>
    </div>
  </td></tr>

  <!-- Action button -->
  <tr><td style="background:#0f172a;padding:20px 28px 24px;text-align:center">
    <a href="${mailtoLink}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:900;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:10px">
      📨 Encaminhar para ${clientEmail || 'cliente'} agora
    </a>
    <div style="color:#475569;font-size:11px;margin-top:8px">Clique no botão → seu Gmail abre já com o email pronto para enviar</div>
  </td></tr>

  <!-- Separator -->
  <tr><td style="padding:0 28px">
    <div style="border-top:2px dashed #334155;margin:0;padding:16px 0 8px;color:#475569;font-size:12px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:.08em">Email completo para o cliente (copie ou encaminhe)</div>
  </td></tr>

  <!-- Client email preview -->
  <tr><td style="padding:0 28px 28px">
    <div style="border:1px solid #334155;border-radius:12px;overflow:hidden;font-size:11px;color:#64748b">
      ${clientHtml}
    </div>
  </td></tr>

  <!-- Tip -->
  <tr><td style="padding:0 28px 28px;text-align:center">
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:14px;color:#475569;font-size:12px">
      💡 <strong style="color:#94a3b8">Dica:</strong> Para enviar direto ao cliente sem encaminhar, verifique um domínio em <a href="https://resend.com/domains" style="color:#f97316">resend.com/domains</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
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

  // ── Send via Resend API ─────────────────────────────────
  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ ok: true, sent: false, warning: 'RESEND_API_KEY não configurada.' }), { headers: CORS })
  }

  const send = async (toAddr, subjectStr, htmlStr, textStr) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [toAddr], subject: subjectStr, text: textStr, html: htmlStr }),
    }).then(r => r.json().then(d => ({ ok: r.ok, data: d })))

  try {
    // 1️⃣ Try sending directly to the client
    const direct = await send(to, subject, html, text)

    if (direct.ok) {
      // ✅ Domain verified — sent directly
      return new Response(JSON.stringify({ ok: true, sent: true, mode: 'direct', id: direct.data.id }), { headers: CORS })
    }

    const msg = direct.data?.message || ''
    const domainNotVerified = msg.includes('testing emails') || msg.includes('own email') || msg.includes('verify a domain')

    if (!domainNotVerified) {
      // Some other Resend error
      console.error('Resend error:', direct.data)
      return new Response(JSON.stringify({ ok: false, sent: false, error: msg }), { headers: CORS })
    }

    // 2️⃣ Domain not verified → notify admin with full template + forward button
    const adminHtml    = buildAdminNotify({ clientEmail: to, type, storeName, username, password })
    const adminSubject = `🆕 Novo ${type === 'market' ? 'mercado' : 'distribuidor'}: ${storeName} — Enviar acesso para ${to}`
    const adminText    = `Novo cliente cadastrado!\n\nNome: ${storeName}\nEmail do cliente: ${to}\nUsuário: ${username}\nSenha: ${password}\n\nEncaminhe o acesso para o cliente.`

    const notify = await send(ADMIN_EMAIL, adminSubject, adminHtml, adminText)

    if (notify.ok) {
      return new Response(JSON.stringify({
        ok: true, sent: true, mode: 'admin-notify',
        note: `Email enviado para ${ADMIN_EMAIL} — encaminhe para ${to}`,
        id: notify.data.id,
      }), { headers: CORS })
    }

    return new Response(JSON.stringify({ ok: false, sent: false, error: notify.data?.message || 'Erro ao notificar admin' }), { headers: CORS })

  } catch (err) {
    console.error('send-email error:', err.message)
    return new Response(JSON.stringify({ ok: false, sent: false, error: err.message }), { headers: CORS })
  }
}

export const config = { path: '/api/send-email' }
