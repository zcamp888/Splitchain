import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
            top: 22,
            right: 22,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: '#a3e635',
            boxShadow: '0 0 18px #a3e635',
          }}
        />
      </div>
    ),
    size
  )
}