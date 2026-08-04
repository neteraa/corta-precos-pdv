/**
 * Footer — etc! (Zatende)
 * Placeholder: dados reais serão atualizados pelo time.
 */
export default function Footer({ variant = 'mkt' }) {
  const isDark = variant === 'forn'

  const styles = isDark
    ? {
        wrapper: { borderTop: '1px solid #0f2236', padding: '14px 16px', textAlign: 'center', marginTop: 'auto' },
        brand:   { color: '#10b981', fontWeight: 900, fontSize: 13, letterSpacing: '-0.01em' },
        tagline: { color: '#334155', fontSize: 11, marginTop: 3 },
        address: { color: '#1e3a50', fontSize: 10, marginTop: 4, lineHeight: 1.6 },
        divider: { color: '#1e3a50', margin: '0 6px' },
      }
    : {
        wrapper: { borderTop: '1px solid #111827', padding: '12px 12px', textAlign: 'center', marginTop: 'auto' },
        brand:   { color: '#ea580c', fontWeight: 900, fontSize: 12, letterSpacing: '-0.01em' },
        tagline: { color: '#4b5563', fontSize: 10, marginTop: 2 },
        address: { color: '#374151', fontSize: 10, marginTop: 3, lineHeight: 1.5 },
        divider: { color: '#374151', margin: '0 4px' },
      }

  return (
    <div style={styles.wrapper}>
      <div style={styles.brand}>etc!</div>
      <div style={styles.tagline}>by Zatende · Tecnologia para o comércio</div>
      <div style={styles.address}>
        🌍 HQ: Dubai, United Arab Emirates
        <span style={styles.divider}>·</span>
        🏢 Bay Square, Business Bay
      </div>
    </div>
  )
}
