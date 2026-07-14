import { ImageResponse } from 'next/og';

export const alt = 'Richmond Summer Camp Finder — search camps by age, week, and distance';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f9fafb',
          padding: '72px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, fontWeight: 600, color: '#2563eb', letterSpacing: '0.08em' }}>
            SCOUTY
          </div>
          {/* Satori has no line-breaking control, so each visual line is its own flex row. */}
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              flexDirection: 'column',
              fontSize: 82,
              fontWeight: 700,
              lineHeight: 1.06,
              color: '#111827',
            }}
          >
            <div style={{ display: 'flex' }}>Richmond Summer</div>
            <div style={{ display: 'flex' }}>Camp Finder</div>
          </div>
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              flexDirection: 'column',
              fontSize: 36,
              lineHeight: 1.3,
              color: '#4b5563',
            }}
          >
            <div style={{ display: 'flex' }}>Search camps by your kid&apos;s age, the weeks you</div>
            <div style={{ display: 'flex' }}>need, and how far you&apos;re willing to drive.</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {['Age', 'Week', 'Location'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                borderRadius: 999,
                background: '#111827',
                color: '#ffffff',
                fontSize: 30,
                fontWeight: 500,
                padding: '14px 32px',
              }}
            >
              {label}
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              borderRadius: 999,
              border: '2px solid #d1d5db',
              color: '#4b5563',
              fontSize: 30,
              fontWeight: 500,
              padding: '14px 32px',
            }}
          >
            Free · no signup
          </div>
        </div>
      </div>
    ),
    size,
  );
}
