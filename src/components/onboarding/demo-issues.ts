export interface DemoIssue {
  title: string
  description: string
  category: string
  priority: string
}

export const DEMO_ISSUES: DemoIssue[] = [
  {
    title: 'Boiler not heating',
    description: 'No hot water since this morning. Tenant reports no heating either.',
    category: 'Plumbing',
    priority: 'Urgent',
  },
  {
    title: 'Leak under kitchen sink',
    description: 'Water pooling under sink unit, dripping from pipe joint.',
    category: 'Plumbing',
    priority: 'Standard',
  },
  {
    title: 'Front door lock jammed',
    description: 'Key won\'t turn in the lock. Tenant is locked out.',
    category: 'Locksmith',
    priority: 'Urgent',
  },
  {
    title: 'Mould in bathroom',
    description: 'Black mould spreading on ceiling above the shower.',
    category: 'Damp & Mould',
    priority: 'Standard',
  },
]
