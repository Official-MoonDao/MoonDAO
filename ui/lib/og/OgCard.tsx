import React from 'react'

/**
 * JSX subset for `@vercel/og` / Satori. Inline flex styles only — no Tailwind,
 * no `gap`, no grid.
 */
export function OgCard({
  eyebrow,
  title,
  subtitle,
  chips,
  footer,
  mediaSrc,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  chips?: string[]
  footer: string
  mediaSrc?: string
}) {
  const visibleChips = (chips || []).filter(Boolean).slice(0, 4)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        background: 'linear-gradient(135deg, #0b1533 0%, #090D21 55%, #1a0b2e 100%)',
        color: 'white',
        padding: 56,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          minWidth: 0,
          marginRight: mediaSrc ? 40 : 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 22,
              letterSpacing: 3,
              color: '#93c5fd',
              textTransform: 'uppercase',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: 'linear-gradient(135deg, #e2e8f0 0%, #64748b 100%)',
                marginRight: 12,
              }}
            />
            {eyebrow}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: title.length > 48 ? 48 : 58,
              fontWeight: 700,
              lineHeight: 1.15,
              marginTop: 28,
              maxWidth: 820,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                color: '#cbd5e1',
                marginTop: 16,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visibleChips.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
              {visibleChips.map((chip) => (
                <div
                  key={chip}
                  style={{
                    display: 'flex',
                    padding: '10px 16px',
                    marginRight: 10,
                    marginBottom: 10,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.08)',
                    fontSize: 22,
                    color: '#e2e8f0',
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              marginTop: 8,
              fontSize: 22,
              color: '#94a3b8',
            }}
          >
            {footer}
          </div>
        </div>
      </div>

      {mediaSrc ? (
        <div
          style={{
            display: 'flex',
            width: 360,
            height: 360,
            borderRadius: 28,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            alignSelf: 'center',
          }}
        >
          <img
            src={mediaSrc}
            alt=""
            width={360}
            height={360}
            style={{ width: 360, height: 360, objectFit: 'cover' }}
          />
        </div>
      ) : null}
    </div>
  )
}
