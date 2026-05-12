'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, Receipt as ReceiptIcon, Trash2, CheckCircle2, AlertCircle, Eye, Sparkles, CreditCard } from 'lucide-react'
import { useMyReceipts, useUploadReceipt, useDeleteReceipt, getReceiptUrl } from '@/lib/hooks/useReceipts'
import { useToast } from '@/components/Toaster'
import { formatCurrency } from '@/lib/balances'

function friendlyError(raw: string | null | undefined): { kind: 'quota' | 'config' | 'parse' | 'other'; message: string } {
  if (!raw) return { kind: 'other', message: 'Could not parse this receipt.' }
  const lower = raw.toLowerCase()
  if (lower.includes('quota') || lower.includes('429') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    return { kind: 'quota', message: 'Gemini rate limit hit. Wait a minute and retry — free tier is 15 requests/min.' }
  }
  if (lower.includes('not configured') || lower.includes('api_key') || lower.includes('api key') || lower.includes('gemini_api_key')) {
    return { kind: 'config', message: 'Gemini API key not configured. Get one free at aistudio.google.com.' }
  }
  if (lower.includes('not a receipt') || lower.includes('could not extract')) {
    return { kind: 'parse', message: 'Image doesn\u2019t look like a receipt, or text is unreadable.' }
  }
  return { kind: 'other', message: raw }
}

export function ReceiptsView() {
  const { data: receipts, isLoading } = useMyReceipts()
  const upload = useUploadReceipt()
  const del = useDeleteReceipt()
  const { push } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      try {
        const r = await upload.mutateAsync(file)
        if (r.ocr_status === 'success') {
          push({ kind: 'success', message: 'Receipt scanned with Gemini ✨' })
        } else {
          const f = friendlyError(r.error_message)
          push({ kind: f.kind === 'quota' || f.kind === 'config' ? 'error' : 'info', message: f.message })
        }
      } catch (e) {
        push({ kind: 'error', message: e instanceof Error ? e.message : 'Upload failed' })
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this receipt?')) return
    try {
      await del.mutateAsync(id)
      push({ kind: 'success', message: 'Removed' })
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const openPreview = async (id: string) => {
    setPreviewLoading(true)
    try {
      const url = await getReceiptUrl(id)
      setPreviewUrl(url)
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Receipts</h1>
        <p className="mt-1 text-sm text-fg-muted">Upload an image &mdash; Gemini reads it for you.</p>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`relative rounded-3xl border-2 border-dashed p-10 text-center transition-all ${
          dragOver
            ? 'border-neon-violet bg-neon-violet/5 scale-[1.01]'
            : 'border-border-strong bg-bg-elev/30 hover:border-neon-cyan/40'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-violet/20 to-neon-cyan/20">
          <Sparkles className="h-7 w-7 text-neon-cyan" aria-hidden="true" />
        </div>
        <h2 className="font-display text-lg font-semibold">Drop a receipt</h2>
        <p className="mt-1 text-sm text-fg-muted">PNG, JPG, HEIC up to 10&nbsp;MB</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="btn-primary mt-5"
        >
          {upload.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Scanning&hellip;
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Choose file
            </>
          )}
        </button>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-lg font-semibold">Your receipts</h2>
        {isLoading ? (
          <div className="glass flex items-center justify-center rounded-2xl p-10 text-fg-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
        ) : !receipts || receipts.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-fg-muted">
            No receipts yet &mdash; upload your first one above.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {receipts.map((r: any) => {
              const p = r.parsed_json || {}
              const success = r.ocr_status === 'success'
              const err = friendlyError(r.error_message)
              return (
                <li key={r.id} className="glass group rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:border-neon-cyan/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      {success ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-success">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Parsed
                        </span>
                      ) : r.ocr_status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-neon-cyan">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          Pending
                        </span>
                      ) : err.kind === 'quota' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neon-violet/30 bg-neon-violet/10 px-2 py-0.5 text-neon-violet">
                          <CreditCard className="h-3 w-3" aria-hidden="true" />
                          Rate limit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-danger">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          Failed
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        onClick={() => openPreview(r.id)}
                        className="rounded-lg p-1.5 text-fg-muted hover:bg-bg-elev hover:text-fg"
                        aria-label="Preview receipt image"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="rounded-lg p-1.5 text-fg-muted hover:bg-danger/10 hover:text-danger"
                        aria-label="Delete receipt"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {success ? (
                    <>
                      <div className="mt-3 font-display text-base font-semibold text-balance line-clamp-1">
                        {p.merchant || 'Unknown merchant'}
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-xs text-fg-muted">{p.date || '\u2014'}</span>
                        <span className="tabular font-mono text-lg font-semibold">
                          {typeof p.total === 'number' ? formatCurrency(p.total, p.currency || 'USD') : '\u2014'}
                        </span>
                      </div>
                      {p.items && p.items.length > 0 && (
                        <div className="mt-3 border-t border-border/60 pt-3 text-xs text-fg-muted">
                          {p.items.slice(0, 3).map((it: any, i: number) => (
                            <div key={i} className="flex justify-between gap-2 truncate">
                              <span className="truncate">{it.name}</span>
                              <span className="shrink-0 tabular font-mono">
                                {typeof it.price === 'number' ? formatCurrency(it.price, p.currency || 'USD') : ''}
                              </span>
                            </div>
                          ))}
                          {p.items.length > 3 && (
                            <div className="mt-1 text-fg-dim">+{p.items.length - 3} more</div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 text-sm text-fg-muted">{err.message}</div>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-dim">
                    <ReceiptIcon className="h-3 w-3" aria-hidden="true" />
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-4 backdrop-blur-md"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Receipt preview"
        >
          <img
            src={previewUrl}
            alt="Receipt"
            className="max-h-[90vh] max-w-full rounded-2xl border border-border-strong shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}