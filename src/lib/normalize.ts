/**
 * Phone: Normalize to +44XXXXXXXXXX format (UK)
 * Handles: 07123456789, +447123456789, 7123456789, 447123456789
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0044')) return '+' + digits.slice(2)
  if (digits.startsWith('44')) return '+' + digits
  if (digits.startsWith('0')) return '+44' + digits.slice(1)
  if (digits.length === 10) return '+44' + digits
  return '+' + digits // Fallback
}

/** Name: Trim + Title Case */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Email: Trim + Lowercase */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Address: Trim only (UK addresses vary too much) */
export function normalizeAddress(address: string): string {
  return address.trim()
}

/**
 * Normalize a record before insert/update.
 * Pass the entity type and raw record, get back normalized version.
 */
export function normalizeRecord(
  entityType: 'properties' | 'tenants' | 'contractors',
  record: Record<string, unknown>
): Record<string, unknown> {
  const normalized = { ...record }

  // Phone fields
  const phoneFields = ['landlord_phone', 'phone', 'contractor_phone']
  phoneFields.forEach((field) => {
    if (normalized[field] && typeof normalized[field] === 'string') {
      normalized[field] = normalizePhone(normalized[field] as string)
    }
  })

  // Name fields
  const nameFields = ['landlord_name', 'full_name', 'contractor_name']
  nameFields.forEach((field) => {
    if (normalized[field] && typeof normalized[field] === 'string') {
      normalized[field] = normalizeName(normalized[field] as string)
    }
  })

  // Email fields
  const emailFields = ['landlord_email', 'email', 'contractor_email']
  emailFields.forEach((field) => {
    if (normalized[field] && typeof normalized[field] === 'string') {
      normalized[field] = normalizeEmail(normalized[field] as string)
    }
  })

  // Address fields
  if (normalized['address'] && typeof normalized['address'] === 'string') {
    normalized['address'] = normalizeAddress(normalized['address'] as string)
  }

  return normalized
}
