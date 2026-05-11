// @ts-nocheck
/* eslint-disable */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are a receipt OCR engine. Extract structured data from receipt images.
Return ONLY valid JSON with this exact shape:
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
- Use ISO date format (YYYY-MM-DD) when possible.
- Currency as 3-letter ISO (USD, EUR, GBP, etc.) or null if unclear.
- All amounts as positive numbers in major units (e.g., 12.50 not 1250).
- If image is not a receipt or unreadable, return: {"error": "not a receipt"}.`

export async function POST(req: any) {
  try {
    const supabase: any = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const file: any = form.get('file')
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

    const service: any = createSupabaseServiceClient()
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
    let ocrStatus = 'failed'
    let errorMessage: any = null

    try {
      if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI not configured')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract data from this receipt as JSON.' },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
      })

      const content = completion.choices[0]?.message?.content || '{}'
      parsed = JSON.parse(content)

      if (parsed.error) {
        ocrStatus = 'failed'
        errorMessage = parsed.error
      } else if (typeof parsed.total !== 'number') {
        ocrStatus = 'failed'
        errorMessage = 'Could not extract total'
      } else {
        ocrStatus = 'success'
      }
    } catch (e: any) {
      errorMessage = e instanceof Error ? e.message : 'OCR failed'
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
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}