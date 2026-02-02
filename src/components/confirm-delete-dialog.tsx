'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

type ConfirmDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  itemName?: string
  onConfirm: () => Promise<void>
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      setError(message)
      toast.error(message)
      console.error('Delete failed:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Clear error when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) setError(null)
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {description}
            {itemName && (
              <span className="block mt-2 font-medium text-foreground">
                &ldquo;{itemName}&rdquo;
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
