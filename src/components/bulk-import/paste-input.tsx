'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { parseText, parseFile, MAX_ROWS } from '@/lib/bulk-import/pipeline'

interface PasteInputProps {
  onParsed: (rows: string[][]) => void
  onError: (error: string) => void
}

export function PasteInput({ onParsed, onError }: PasteInputProps) {
  const [text, setText] = useState('')
  const [rowCount, setRowCount] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleTextChange = useCallback(
    (rawText: string) => {
      setText(rawText)
      if (!rawText.trim()) {
        setRowCount(null)
        return
      }
      const { rows, error } = parseText(rawText)
      if (error) {
        onError(error)
        setRowCount(null)
        return
      }
      setRowCount(rows.length)
      onParsed(rows)
    },
    [onParsed, onError]
  )

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const { rows, error } = await parseFile(file)
      if (error) {
        onError(error)
        return
      }
      setRowCount(rows.length)
      setText(`[Loaded from ${file.name}]`)
      onParsed(rows)
      e.target.value = ''
    },
    [onParsed, onError]
  )

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text/plain')
            handleTextChange(pasted)
          }}
          placeholder="Paste rows from your spreadsheet here..."
          className="w-full min-h-[200px] rounded-lg border border-border bg-card p-4 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
        {rowCount !== null && (
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground bg-card px-2 py-1 rounded border">
            <FileSpreadsheet className="h-3 w-3 inline mr-1" />
            {rowCount} rows detected
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={handleFileUpload}
          className="hidden"
          ref={fileRef}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          Or upload a CSV file
        </Button>
        <span className="text-xs text-muted-foreground">
          Max {MAX_ROWS} rows per import
        </span>
      </div>
    </div>
  )
}
