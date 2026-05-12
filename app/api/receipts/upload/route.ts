// @integration: supabase
// @integration: gemini
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are a receipt OCR engine. Extract structured data from this receipt image.
Return ONLY valid JSON (no markdown, no code fences) with this exact shape:
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
- Output raw JSON only — no code fences, no commentary.`

const MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-flash-latest',
  'gemini-1.5-flash-latest',
]

function stripCodeFences(s: string): string {
  let trimmed = s.trim()
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  return trimmed.trim()
}

async function runGemini(apiKey: string, mimeType: string, base64: string) {
  const genAI = new GoogleGenerativeAI(apiKey)
  let lastError: Error | null = null

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      })

      const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { inlineData: { mimeType, data: base64 } },
      ])

      return { text: result.response.text(), modelUsed: modelName }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      // Only fall through on 404 (model retired); other errors abort
      if (!lastError.message.includes('404') && !lastError.message.includes('not found')) {
        throw lastError
      }
    }
  }

  throw lastError || new Error('All Gemini models failed')
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
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured — add it in Vercel env vars')
      }

      const { text } = await runGemini(
        process.env.GEMINI_API_KEY,
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
      errorMessage = e instanceof Error ? e.message : 'Gemini OCR failed'
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
