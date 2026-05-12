import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0a0b14 0%, #141728 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 110,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: -4,
          }}
        >
          S
        </div>
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: '#a3e635',
            boxShadow: '0 0 20px #a3e635',
          }}
        />
      </div>
    ),
    size
  )
}