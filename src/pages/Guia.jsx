/**
 * /guia — Passo a passo para ambas as plataformas
 * Página pública, sem auth. Serve de onboarding e material de vendas.
 */
import React, { useState } from 'react'
import ZatendeStockLogo from '../components/ZatendeStockLogo.jsx'

const VERSION = 'v3.1'
const UPDATED = 'Agosto 2026'

const ORANGE = '#f97316'
const GREEN  = '#10b981'
const BLUE   = '#3b82f6'
const DARK   = '#050f1a'
const CARD   = '#0d2137'
const BORDER = '#1a3a50'

function Badge({ color, children }) {
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 800,
      display: 'inline-block',
    }}>{children}</span>
  )
}

function Step({ n, icon, title, desc, tip }) {
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      background: CARD, borderRadius: 16, padding: '16px 18px',
      border: `1px solid ${BORDER}`, marginBottom: 10,
    }}>
      <div style={{
        minWidth: 36, height: 36, borderRadius: 12,
        background: `linear-gradient(135deg,${ORANGE}33,${ORANGE}11)`,
        border: `1px solid ${ORANGE}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: ORANGE, fontWeight: 900, fontSize: 15, flexShrink: 0,
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14 }}>{title}</span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{desc}</div>
        {tip && (
          <div style={{
            marginTop: 8, background: '#0a2540', borderRadius: 8, padding: '7px 10px',
            color: '#38bdf8', fontSize: 12, borderLeft: `3px solid ${BLUE}`,
          }}>💡 {tip}</div>
        )}
      </div>
    </div>
  )
}

function Feature({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>{text}</span>
    </div>
  )
}

function Section({ title, subtitle, color, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        background: `linear-gradient(135deg,${color}22,${color}08)`,
        border: `1px solid ${color}33`, borderRadius: 20,
        padding: '20px 22px', marginBottom: 20,
      }}>
        <div style={{ color, fontWeight: 900, fontSize: 18 }}>{title}</div>
        <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  )
}

export default function Guia() {
  const [tab, setTab] = useState('mercado')

  return (
    <div style={{ minHeight: '100dvh', background: DARK, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        * { box-sizing: border-box }
      `}</style>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#0a1929,#0d2137)', borderBottom: `1px solid ${BORDER}`, padding: '24px 20px', textAlign: 'center' }}>
        <ZatendeStockLogo variant="full" />
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge color={ORANGE}>{VERSION}</Badge>
          <Badge color={GREEN}>Atualizado {UPDATED}</Badge>
          <Badge color={BLUE}>Guia Completo</Badge>
        </div>
        <div style={{ color: '#475569', fontSize: 13, marginTop: 10 }}>
          Sistema de Gestão Inteligente para Atacadistas e Varejistas
        </div>
      </div>

      {/* ── Tab switcher ───────────────────────────── */}
      <div style={{ display: 'flex', background: '#0a1929', borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 50 }}>
        {[
          { id: 'mercado',     label: '🏪 Para o Mercado',      color: ORANGE },
          { id: 'distribuidor', label: '🚚 Para o Distribuidor', color: GREEN  },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '14px 8px', border: 'none', background: 'transparent',
            cursor: 'pointer', fontWeight: 800, fontSize: 13,
            color: tab === t.id ? t.color : '#475569',
            borderBottom: tab === t.id ? `3px solid ${t.color}` : '3px solid transparent',
            transition: 'all .2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 60px', animation: 'fadeIn .3s ease' }}>

        {/* ════════════════════════════════════════════
            TAB — MERCADO (PDV)
        ════════════════════════════════════════════ */}
        {tab === 'mercado' && (
          <>
            <div style={{ background: `linear-gradient(135deg,${ORANGE}22,${ORANGE}08)`, borderRadius: 20, padding: '18px 20px', marginBottom: 28, border: `1px solid ${ORANGE}33` }}>
              <div style={{ color: ORANGE, fontWeight: 900, fontSize: 16 }}>Portal Corta Preços — PDV</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                Caixa, estoque, validade, promoções e fidelidade — tudo em um só lugar
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Badge color={ORANGE}>🌐 zatendestock.netlify.app/login</Badge>
                <Badge color="#94a3b8">Usuário: admin · Senha: 1234</Badge>
              </div>
            </div>

            <Section title="1. Primeiro Acesso" subtitle="Leva menos de 2 minutos" color={ORANGE}>
              <Step n="1" icon="🌐" title="Abra o link no celular ou PC"
                desc="Acesse zatendestock.netlify.app. No celular, clique em 'Adicionar à tela inicial' para instalar como app (sem precisar de loja de apps)."
                tip="Chrome/Edge no Android: menu ⋮ → 'Adicionar à tela inicial'" />
              <Step n="2" icon="🔐" title='Clique em "Acesso ao sistema"'
                desc='Na tela inicial, clique no botão 🔐 Acesso ao sistema. Digite usuário e senha. Para a demo: admin / 1234.'
                tip="Cada mercado tem seu próprio usuário e senha — fale com (011) 98595-0956 para cadastrar o seu" />
              <Step n="3" icon="📊" title="Dashboard — visão geral"
                desc="Ao entrar, você vê o Dashboard com as vendas do dia, produtos com validade próxima e resumo do caixa."
                tip="O banner laranja no topo avisa quando tem produto vencendo em até 30 dias" />
            </Section>

            <Section title="2. Usando o Caixa (PDV)" subtitle="F2 busca, F10 finaliza" color={ORANGE}>
              <Step n="1" icon="🛒" title='Vá em "PDV / Caixa" no menu'
                desc="Clique em PDV / Caixa no menu lateral esquerdo ou pressione F2 para focar na busca." />
              <Step n="2" icon="🔍" title="Busque o produto"
                desc="Digite o nome, código de barras ou escaneie com o leitor. No celular, clique no botão Scanner para usar a câmera."
                tip="🎤 Também dá pra falar o produto! Clique no ícone de microfone e diga 'Heineken lata'" />
              <Step n="3" icon="➕" title="Adicione ao carrinho"
                desc="Clique no produto ou pressione Enter. Ajuste a quantidade na linha do carrinho se precisar." />
              <Step n="4" icon="💰" title="Finalize a venda — F10"
                desc="Escolha a forma de pagamento: Dinheiro, PIX, Débito ou Crédito. Pressione F10 ou clique em FINALIZAR VENDA."
                tip="F4 aplica desconto extra. Para dividir o pagamento, clique em 'Dividir pagamento'" />
            </Section>

            <Section title="3. Estoque e Validade" subtitle="Controle total de produtos" color={ORANGE}>
              <Step n="1" icon="📦" title="Receber mercadoria"
                desc="Vá em Estoque → clique em 'Receber Mercadoria' → selecione o produto, informe a quantidade e a data de validade."
                tip="Use o Scanner Celular (/scan?mode=estoque) para dar entrada de qualquer lugar do depósito" />
              <Step n="2" icon="⚠️" title="Monitorar vencimentos"
                desc="A página Validade mostra todos os produtos com código de cores: 🔴 Vencido · 🟠 Crítico ≤7d · 🟡 Atenção · 🟢 OK."
                tip="Clique em 'Gerar Promoção' para criar automaticamente uma promoção de queima no produto que vai vencer" />
              <Step n="3" icon="🏷️" title="Criar promoções"
                desc='Em Promoções, crie grupos de preço por quantidade: "2 por R$ 9,99". O PDV aplica automaticamente ao bater a quantidade.' />
            </Section>

            <Section title="4. Ferramentas Extras" subtitle="WhatsApp, fidelidade e relatórios" color={ORANGE}>
              <Feature icon="📱" text="Campanhas / ZAP — envie promoções via WhatsApp para seus clientes cadastrados" />
              <Feature icon="🎁" text="Fidelidade — gere QR codes de pontos por compra, resgatados pelo WhatsApp" />
              <Feature icon="📊" text="Relatório — veja as vendas por período, produto e forma de pagamento" />
              <Feature icon="🏷️" text="Etiquetas — imprima etiquetas de preço no padrão supermercado" />
              <Feature icon="💳" text="Fiado — controle as vendas a prazo por cliente com histórico completo" />
              <Feature icon="📋" text="Clientes — cadastre clientes e veja o histórico de compras" />
              <Feature icon="📡" text="Ofertas Distribuidor — veja no menu lateral as ofertas do seu distribuidor em tempo real" />
            </Section>

            <div style={{ background: '#0a2540', borderRadius: 16, padding: 20, textAlign: 'center', border: `1px solid ${BLUE}33` }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>❓</div>
              <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 15 }}>Precisa de ajuda?</div>
              <div style={{ color: '#64748b', fontSize: 13, margin: '8px 0 16px' }}>Fale com a gente via WhatsApp</div>
              <a href="https://wa.me/5511985950956?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20ZatendeStock"
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#16a34a', color: '#fff', fontWeight: 900, fontSize: 14, padding: '12px 24px', borderRadius: 12, textDecoration: 'none' }}>
                💬 (011) 98595-0956
              </a>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════
            TAB — DISTRIBUIDOR
        ════════════════════════════════════════════ */}
        {tab === 'distribuidor' && (
          <>
            <div style={{ background: `linear-gradient(135deg,${GREEN}22,${GREEN}08)`, borderRadius: 20, padding: '18px 20px', marginBottom: 28, border: `1px solid ${GREEN}33` }}>
              <div style={{ color: GREEN, fontWeight: 900, fontSize: 16 }}>Portal do Distribuidor</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                Controle lotes, publique ofertas e gerencie pedidos dos mercados via WhatsApp
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Badge color={GREEN}>🌐 zatendestock.netlify.app/fornecedor</Badge>
                <Badge color="#94a3b8">Usuário: megatudo · Senha: mega2024</Badge>
              </div>
            </div>

            <Section title="1. Primeiro Acesso" subtitle="Configure em 5 minutos" color={GREEN}>
              <Step n="1" icon="🌐" title="Abra o portal do distribuidor"
                desc="Acesse zatendestock.netlify.app/fornecedor. Instale como app no celular para acessar mais rápido."
                tip="O portal é 100% separado do portal do mercado — tenha os dois abertos em abas diferentes" />
              <Step n="2" icon="🔐" title="Faça login"
                desc="Use as credenciais fornecidas. Para a demo: megatudo / mega2024. Após o login você vê o dashboard FIFO." />
              <Step n="3" icon="🏢" title="Configure seu perfil"
                desc='Clique na aba "Perfil" (último ícone) → preencha nome da distribuidora, telefone e logo. Isso aparece para todos os mercados.'
                tip="O logo e os dados do seu perfil aparecem na vitrine digital dos mercados e nas mensagens de WhatsApp" />
              <Step n="4" icon="🏪" title="Cadastre seus mercados"
                desc='Vá na aba "Mercados" → clique em "+ Adicionar" → preencha nome, WhatsApp, endereço e contato do comprador.'
                tip="Adicione o logo do mercado para aparecer na vitrine digital deles. Cada mercado terá seu link exclusivo /loja/nome-do-mercado" />
            </Section>

            <Section title="2. Receber Mercadoria" subtitle="Cada lote entra com custo e validade" color={GREEN}>
              <Step n="1" icon="📦" title='Abra a aba "Receber"'
                desc='Na barra inferior, clique em "Receber". Esta é a tela de entrada de mercadoria.' />
              <Step n="2" icon="🏷️" title="Informe a origem do lote"
                desc='Escolha a origem: 🔨 Leilão, 📦 Danificado, 👤 Contato, 🏭 Atacadista ou ❓ Avulso. Isso organiza o histórico.' />
              <Step n="3" icon="✍️" title="Digite o produto (texto livre)"
                desc='No campo "Produto", digite o nome — não precisa de código de barras ou cadastro. Ex: "Heineken 350ml Lata". Ou escaneie com a câmera.'
                tip="O campo aceita texto livre — perfeito para lotes de leilão com produtos variados" />
              <Step n="4" icon="💰" title="Informe custo, validade e preço"
                desc="Preencha o total pago pelo lote → o custo unitário é calculado automaticamente. Escolha a validade (atalhos 7/15/30/60/90 dias) e o preço para os mercados."
                tip="A margem de lucro aparece ao vivo enquanto você digita" />
              <Step n="5" icon="🚀" title="Dar Entrada + Disparar"
                desc="Clique no botão verde para registrar o lote e abrir o WhatsApp para cada mercado com a oferta pronta."
                tip="O botão 'Blitz' na tela inicial baixa % de todas as ofertas e dispara para todos de uma vez" />
            </Section>

            <Section title="3. Gerenciar Pedidos" subtitle="Do pedido à entrega em 2 cliques" color={GREEN}>
              <Step n="1" icon="🔔" title="Badge de pedidos aparece na aba"
                desc='Quando um mercado faz um pedido via /ofertas, o badge na aba "Pedidos" atualiza em ≤10 segundos — sem precisar recarregar.' />
              <Step n="2" icon="✅" title="Confirmar o pedido"
                desc='Na aba Pedidos, clique em "✅ Confirmar + 📱 Avisar Mercado". O WhatsApp abre com a mensagem de confirmação pronta.'
                tip="O mercado vê o status mudar de '🕐 Aguardando' para '✅ Confirmado!' em tempo real" />
              <Step n="3" icon="🚚" title="Registrar entrega"
                desc='"Entreguei + 📱 Avisar Mercado" — baixa automaticamente do seu estoque e notifica o mercado via WhatsApp.' />
              <Step n="4" icon="💬" title="Parser de pedido pelo WhatsApp"
                desc='No header da aba Pedidos, clique em "📄 ZAP". Cole a mensagem que o comprador te enviou — "24 Heineken 12 Coca" — e o sistema cria os pedidos automaticamente.'
                tip="Suporta: '24 heineken', 'heineken 24', '24x heineken' — qualquer formato" />
            </Section>

            <Section title="4. Inteligência e Análises" subtitle="Dados que ajudam a vender mais" color={GREEN}>
              <Feature icon="🔮" text="Rupturas — prevê quais produtos vão zerar no estoque dos mercados com botão de aviso direto" />
              <Feature icon="🏆" text="Score A/B/C/D — classifica cada mercado por frequência, recência e volume de pedidos" />
              <Feature icon="📈" text="Sell-Out — veja o que cada mercado está vendendo dos seus produtos" />
              <Feature icon="📊" text="Resultado — balanço completo: gasto × faturado × lucro por período" />
              <Feature icon="📱" text="Vitrine Digital — cada mercado tem uma página pública /loja/nome-do-mercado para mostrar seu catálogo" />
              <Feature icon="📸" text="Scanner NF-e — escaneie QR da nota fiscal para registrar compras com todos os dados" />
              <Feature icon="🔄" text="Recorrências — configure pedidos automáticos semanais por mercado para nunca esquecer de repor" />
            </Section>

            <Section title="5. Fluxo Completo de uma Venda" subtitle="Do leilão ao bolso" color={GREEN}>
              <div style={{ background: CARD, borderRadius: 16, padding: 20, border: `1px solid ${BORDER}` }}>
                {[
                  ['1', '🔨', 'Você compra 300 Heineken no leilão por R$ 1.140,00'],
                  ['2', '📦', 'Receber → lote entra com custo R$ 3,80/un, validade 30d, preço p/ mercado R$ 5,50/un'],
                  ['3', '📱', 'Dar Entrada → BlastScreen abre WA para 5 mercados com link das ofertas'],
                  ['4', '🛒', 'Mercado abre /ofertas → faz pedido de 120 un → WA chega pra você'],
                  ['5', '✅', 'Você confirma → WA automático "✅ Confirmado! Entrega 2ª feira"'],
                  ['6', '🚚', 'Entrega feita → "Entreguei" → estoque baixa, mercado recebe aviso'],
                  ['7', '💰', 'Lucro: R$ 204 no lote (R$ 5,50 − R$ 3,80 = R$ 1,70 × 120un)'],
                ].map(([n, icon, text]) => (
                  <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ minWidth: 24, height: 24, borderRadius: 8, background: `${GREEN}22`, border: `1px solid ${GREEN}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GREEN, fontWeight: 900, fontSize: 11, flexShrink: 0 }}>{n}</div>
                    <div>
                      <span style={{ fontSize: 16, marginRight: 6 }}>{icon}</span>
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>{text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <div style={{ background: '#0a2540', borderRadius: 16, padding: 20, textAlign: 'center', border: `1px solid ${BLUE}33` }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>❓</div>
              <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 15 }}>Suporte & Ativação</div>
              <div style={{ color: '#64748b', fontSize: 13, margin: '8px 0 16px' }}>Cadastro de novos distribuidores via WhatsApp</div>
              <a href="https://wa.me/5511985950956?text=Olá!%20Quero%20conhecer%20o%20Portal%20do%20Distribuidor%20ZatendeStock"
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#16a34a', color: '#fff', fontWeight: 900, fontSize: 14, padding: '12px 24px', borderRadius: 12, textDecoration: 'none' }}>
                💬 (011) 98595-0956
              </a>
            </div>
          </>
        )}

        {/* ── Footer ──────────────────────────────── */}
        <div style={{ marginTop: 40, textAlign: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 24 }}>
          <ZatendeStockLogo variant="wordmark" />
          <div style={{ color: '#1e4060', fontSize: 11, marginTop: 8 }}>
            {VERSION} · {UPDATED} · Zatende — Dubai, UAE
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <a href="/login"       style={{ color: '#475569', fontSize: 12, textDecoration: 'none' }}>🏪 Mercado</a>
            <a href="/fornecedor"  style={{ color: '#475569', fontSize: 12, textDecoration: 'none' }}>🚚 Distribuidor</a>
            <a href="/ofertas"     style={{ color: '#475569', fontSize: 12, textDecoration: 'none' }}>📦 Portal Ofertas</a>
          </div>
        </div>

      </div>
    </div>
  )
}
