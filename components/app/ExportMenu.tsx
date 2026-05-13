'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { useExportGroupCSV } from '@/lib/hooks/useExport'
import { useToast } from '@/components/Toaster'

export function ExportMenu({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const exportCsv = useExportGroupCSV()
  const { push } = useToast()

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const handleExport = async () => {
    try {
      await exportCsv.mutateAsync({ groupId, groupName })
      push({ kind: 'success', message: 'CSV downloaded' })
      setOpen(false)
    } catch (e) {
      push({ kind: 'error', message: e instanceof Error ? e.message : 'Export failed' })
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        aria-label="Export options"
        aria-expanded={open}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export
      </button>
      {open && (
        <div
          role="menu"
          className="glass-strong absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl shadow-2xl"
        >
          <button
            onClick={handleExport}
            disabled={exportCsv.isPending}
            role="menuitem"
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-bg-elev/40 disabled:opacity-50"
          >
            {exportCsv.isPending ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neon-cyan" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-neon-cyan" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <div className="font-medium">Download CSV</div>
              <div className="text-xs text-fg-dim">Expenses, settlements, balances</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}