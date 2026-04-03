import { CERT_TYPE_CONTRACTOR_CATEGORIES, type CertificateType } from './constants'

export interface ContractorWithCategories {
  id: string
  contractor_name: string
  categories: string[] | null
}

export function contractorMatchesCertType(
  contractor: ContractorWithCategories,
  certType: CertificateType
): boolean {
  const relevant = CERT_TYPE_CONTRACTOR_CATEGORIES[certType]
  if (!relevant) return false
  if (!contractor.categories?.length) return false
  return contractor.categories.some(cat =>
    relevant.some(rc => rc.toLowerCase() === cat.toLowerCase())
  )
}

export function partitionContractors(
  contractors: ContractorWithCategories[],
  certType: CertificateType
): [matching: ContractorWithCategories[], other: ContractorWithCategories[]] {
  const matching: ContractorWithCategories[] = []
  const other: ContractorWithCategories[] = []
  for (const c of contractors) {
    if (contractorMatchesCertType(c, certType)) matching.push(c)
    else other.push(c)
  }
  return [matching, other]
}
