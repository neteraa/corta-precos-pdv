/**
 * Footer — etc! (Zatende)
 * Placeholder: dados reais serão atualizados pelo time.
 */
export default function Footer({ variant = 'mkt' }) {
  const isDark = variant === 'forn'

  const styles = isDark
    ? {
        wrapper: { borderTop: '1px solid #0f2236', padding: '12px 16px', textAlign: 'center', marginTop: 'auto' },
        brand:   { color: '#10b981', fontWeight: 900, fontSize: 13, letterSpacing: '-0.01em' },
        tagline: { color: '#1e4060', fontSize: 10, marginTop: 2 },
        address: { color: '#1e3a50', fontSize: 10, marginTop: 4, lineHeight: 1.5 },
        divider: { color: '#0f2236', margin: '0 4px' },
      }
    : {
        wrapper: { borderTop: '1px solid #111827', padding: '10px 12px', textAlign: 'center', marginTop: 'auto' },
        brand:   { color: '#ea580c', fontWeight: 900, fontSize: 11, letterSpacing: '-0.01em' },
        tagline: { color: '#374151', fontSize: 9, marginTop: 1 },
        address: { color: '#1f2937', fontSize: 9, marginTop: 3, lineHeight: 1.5 },
        divider: { color: '#1f2937', margin: '0 3px' },
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
