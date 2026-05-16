// @integration: supabase
// @integration: groq
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

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

const MODEL_CANDIDATES = [
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
]

function stripCodeFences(s: string): string {
  let trimmed = s.trim()
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  return trimmed.trim()
}

async function runGroq(apiKey: string, mimeType: string, base64: string) {
  const groq = new Groq({ apiKey })
  let lastError: Error | null = null

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const completion = await groq.chat.completions.create({
        model: modelName,
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
      })

      const text = completion.choices[0]?.message?.content || ''
      return { text, modelUsed: modelName }
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e))
      const msg = lastError.message.toLowerCase()
      if (
        !msg.includes('decommissioned') &&
        !msg.includes('not found') &&
        !msg.includes('does not exist') &&
        !msg.includes('model_not_found')
      ) {
        throw lastError
      }
    }
  }

  throw lastError || new Error('All Groq vision models failed')
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
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not configured — get one free at console.groq.com')
      }

      const { text } = await runGroq(
        process.env.GROQ_API_KEY,
        file.type,
        buffer.toString('base64')
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
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : 'Groq OCR failed'
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
