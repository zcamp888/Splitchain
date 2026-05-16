// @integration: supabase
// @integration: anthropic
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are a receipt OCR engine. Extract structured data from the receipt image.
Return ONLY valid JSON (no markdown, no code fences, no commentary) with this exact shape:
{
  "merchant": string | null,
  "date": string | null,
  "currency": string | null,
  "subtotal": number | null,
  "tax": number | null,
  "tip": number | null,
  "total": number,
  "items": [{ "name": string, "qty": number, "price": number }]
}
Rules:
- Use ISO date format (YYYY-MM-DD) when possible.
- Currency as 3-letter ISO code (USD, EUR, GBP, etc.) or null if unclear.
- All amounts as positive numbers in major units (12.50 not 1250).
- If image is not a receipt or unreadable, return exactly: {"error": "not a receipt"}.
- Output raw JSON only.`

// Current Claude 4.x models — older 3.x models were retired April 2026.
// Haiku 4.5 is the fast/cheap default; Sonnet 4.5 is the smarter fallback.
const MODEL_CANDIDATES = [
  'claude-haiku-4-5',
  'claude-sonnet-4-5',
]

function stripCodeFences(s: string): string {
  let trimmed = s.trim()
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  return trimmed.trim()
}

function mimeForClaude(mime: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const m = mime.toLowerCase()
  if (m.includes('png')) return 'image/png'
  if (m.includes('gif')) return 'image/gif'
  if (m.includes('webp')) return 'image/webp'
  return 'image/jpeg'
}

async function callClaudeWithFallback(
  anthropic: Anthropic,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<{ text: string; modelUsed: string }> {
  let lastErr: any = null
  const triedModels: string[] = []

  for (const model of MODEL_CANDIDATES) {
    try {
      triedModels.push(model)
      const response = await anthropic.messages.create({
        model,
        max_tokens: 2048,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              { type: 'text', text: SYSTEM_PROMPT },
            ],
          },
        ],
      })
      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Claude returned no text content')
      }
      return { text: textBlock.text, modelUsed: model }
    } catch (e: any) {
      lastErr = e
      const msg = e?.message || ''
      const status = e?.status
      // 404 = model not available on this account → try next
      // Other errors (auth, quota, rate-limit) → bubble up immediately
      if (status === 404 || /not_found/i.test(msg)) {
        continue
      }
      throw e
    }
  }

  const err = new Error(
    `No Claude model available on your account. Tried: ${triedModels.join(', ')}. ` +
    `Check console.anthropic.com/settings/billing — make sure your workspace has credit and model access.`
  )
  ;(err as any).cause = lastErr
  throw err
}

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'must be an image' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'max 10MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const service = createSupabaseServiceClient()
    const { error: uploadErr } = await service.storage
      .from('receipts')
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploadErr) throw uploadErr

    const { data: receipt, error: insertErr } = await supabase
      .from('receipts')
      .insert({
        uploaded_by: user.id,
        storage_path: path,
        ocr_status: 'pending',
      })
      .select()
      .single()
    if (insertErr) throw insertErr

    let parsed: any = null
    let ocrStatus: 'success' | 'failed' = 'failed'
    let errorMessage: string | null = null

    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured — get one at console.anthropic.com')
      }

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const { text } = await callClaudeWithFallback(
        anthropic,
        buffer.toString('base64'),
        mimeForClaude(file.type)
      )

      const clean = stripCodeFences(text)
      parsed = JSON.parse(clean)

      if (parsed.error) {
        ocrStatus = 'failed'
        errorMessage = parsed.error
      } else if (typeof parsed.total !== 'number') {
        ocrStatus = 'failed'
        errorMessage = 'Could not extract total from receipt'
      } else {
        ocrStatus = 'success'
      }
    } catch (e: any) {
      errorMessage = e?.message || 'Claude OCR failed'
      ocrStatus = 'failed'
    }

    const { data: updated } = await supabase
      .from('receipts')
      .update({
        parsed_json: parsed,
        ocr_status: ocrStatus,
        error_message: errorMessage,
      })
      .eq('id', receipt.id)
      .select()
      .single()

    return NextResponse.json({ receipt: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 500 })
  }
}
