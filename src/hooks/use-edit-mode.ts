'use client'

import { useState, useCallback } from 'react'

type AuditEntry = {
  at: string
  by: string
  changes: Record<string, { from: unknown; to: unknown }>
}

type UseEditModeOptions<T> = {
  initialData: T | null
  onSave: (data: T, auditEntry: AuditEntry) => Promise<void>
  pmId: string
}

export function useEditMode<T extends object>({
  initialData,
  onSave,
  pmId,
}: UseEditModeOptions<T>) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<T | null>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset edited data when initialData changes
  const resetData = useCallback((data: T | null) => {
    setEditedData(data)
    setIsEditing(false)
    setError(null)
  }, [])

  const startEditing = useCallback(() => {
    setIsEditing(true)
    setError(null)
  }, [])

  const cancelEditing = useCallback(() => {
    setEditedData(initialData)
    setIsEditing(false)
    setError(null)
  }, [initialData])

  const updateField = useCallback((field: keyof T, value: unknown) => {
    setEditedData((prev) => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }, [])

  const saveChanges = useCallback(async () => {
    if (!editedData || !initialData) return

    // Calculate changes
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const key of Object.keys(editedData) as (keyof T)[]) {
      const oldVal = initialData[key]
      const newVal = editedData[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key as string] = { from: oldVal, to: newVal }
      }
    }

    if (Object.keys(changes).length === 0) {
      setIsEditing(false)
      return
    }

    const auditEntry: AuditEntry = {
      at: new Date().toISOString(),
      by: pmId,
      changes,
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(editedData, auditEntry)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [editedData, initialData, pmId, onSave])

  return {
    isEditing,
    editedData,
    isSaving,
    error,
    startEditing,
    cancelEditing,
    updateField,
    saveChanges,
    resetData,
  }
}

// Hook for create mode (new records)
type UseCreateModeOptions<T> = {
  defaultData: T
  onCreate: (data: T) => Promise<void>
}

export function useCreateMode<T extends object>({
  defaultData,
  onCreate,
}: UseCreateModeOptions<T>) {
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<T>(defaultData)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCreating = useCallback(() => {
    setFormData(defaultData)
    setIsCreating(true)
    setError(null)
  }, [defaultData])

  const cancelCreating = useCallback(() => {
    setFormData(defaultData)
    setIsCreating(false)
    setError(null)
  }, [defaultData])

  const updateField = useCallback((field: keyof T, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const saveNew = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      await onCreate(formData)
      setIsCreating(false)
      setFormData(defaultData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create record')
    } finally {
      setIsSaving(false)
    }
  }, [formData, onCreate, defaultData])

  return {
    isCreating,
    formData,
    isSaving,
    error,
    startCreating,
    cancelCreating,
    updateField,
    saveNew,
  }
}
