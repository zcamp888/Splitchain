function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCSV(rows: Record<string, any>[], columns?: string[]): string {
  if (rows.length === 0) return ''
  const cols = columns || Object.keys(rows[0])
  const header = cols.map(escapeCSV).join(',')
  const body = rows.map((r) => cols.map((c) => escapeCSV(r[c])).join(',')).join('\n')
  return `${header}\n${body}`
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}