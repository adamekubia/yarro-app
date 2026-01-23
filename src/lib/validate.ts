export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) {
    return { valid: false, error: 'Phone must be 10-15 digits' }
  }
  return { valid: true }
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!regex.test(email.trim())) {
    return { valid: false, error: 'Invalid email format' }
  }
  return { valid: true }
}

export function validateRequired(value: string, fieldName: string): { valid: boolean; error?: string } {
  if (!value?.trim()) {
    return { valid: false, error: `${fieldName} is required` }
  }
  return { valid: true }
}
