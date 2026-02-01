/**
 * UK Postcode utilities
 * Uses free postcodes.io API for city lookup with address text fallback
 */

// UK postcode regex - matches at end of string
const UK_POSTCODE_REGEX = /([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})$/i

// Common UK cities/towns for fallback extraction from address text
const UK_CITIES = [
  'London', 'Birmingham', 'Manchester', 'Leeds', 'Liverpool', 'Sheffield',
  'Bristol', 'Newcastle', 'Nottingham', 'Leicester', 'Coventry', 'Bradford',
  'Cardiff', 'Belfast', 'Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee',
  'Salford', 'Bolton', 'Bury', 'Oldham', 'Rochdale', 'Stockport', 'Trafford',
  'Wigan', 'Tameside', 'Warrington', 'Preston', 'Blackburn', 'Blackpool',
  'Burnley', 'Lancaster', 'Sunderland', 'Gateshead', 'Durham', 'Middlesbrough',
  'Darlington', 'Hartlepool', 'York', 'Hull', 'Doncaster', 'Barnsley',
  'Rotherham', 'Wakefield', 'Huddersfield', 'Halifax', 'Dewsbury',
  'Derby', 'Stoke', 'Wolverhampton', 'Walsall', 'Dudley', 'Solihull',
  'Reading', 'Oxford', 'Cambridge', 'Milton Keynes', 'Luton', 'Northampton',
  'Peterborough', 'Norwich', 'Ipswich', 'Colchester', 'Chelmsford',
  'Southampton', 'Portsmouth', 'Brighton', 'Bournemouth', 'Plymouth',
  'Exeter', 'Bath', 'Swindon', 'Gloucester', 'Cheltenham', 'Worcester',
  'Hereford', 'Swansea', 'Newport', 'Wrexham', 'Bangor',
]

/**
 * Try to extract city name from address text (fallback when API fails)
 */
function extractCityFromAddressText(address: string): string | null {
  if (!address) return null
  const upperAddress = address.toUpperCase()

  // Look for known cities in the address (case-insensitive)
  for (const city of UK_CITIES) {
    // Match as whole word (surrounded by comma, space, or start/end)
    const regex = new RegExp(`(^|[,\\s])${city}([,\\s]|$)`, 'i')
    if (regex.test(address)) {
      return city // Return with proper casing
    }
  }
  return null
}

/**
 * Extract UK postcode from an address string
 * Returns null if no valid postcode found
 */
export function extractUKPostcode(address: string): string | null {
  if (!address) return null
  const match = address.trim().match(UK_POSTCODE_REGEX)
  if (!match) return null
  // Normalize: uppercase, ensure single space
  const postcode = match[1].toUpperCase().replace(/\s+/, ' ')
  // Add space if missing (e.g., "M11AA" -> "M1 1AA")
  if (!postcode.includes(' ')) {
    const inward = postcode.slice(-3)
    const outward = postcode.slice(0, -3)
    return `${outward} ${inward}`
  }
  return postcode
}

/**
 * Lookup city (admin_district) from UK postcode using postcodes.io
 * Returns null if lookup fails
 */
export async function lookupPostcodeCity(postcode: string): Promise<string | null> {
  if (!postcode) return null
  try {
    // Encode postcode for URL (handle spaces)
    const encoded = encodeURIComponent(postcode.trim())
    const response = await fetch(`https://api.postcodes.io/postcodes/${encoded}`)
    if (!response.ok) return null
    const data = await response.json()
    if (data.status !== 200 || !data.result) return null
    // Return admin_district (city/borough)
    return data.result.admin_district || null
  } catch {
    return null
  }
}

/**
 * Extract postcode from address and lookup city
 * Uses API first, falls back to extracting city from address text
 * Returns city name or null
 */
export async function getCityFromAddress(address: string): Promise<string | null> {
  // Try API lookup first
  const postcode = extractUKPostcode(address)
  if (postcode) {
    const apiCity = await lookupPostcodeCity(postcode)
    if (apiCity) return apiCity
  }

  // Fallback: extract city from address text
  return extractCityFromAddressText(address)
}

/**
 * Batch lookup cities for multiple addresses
 * Returns Map of address -> city (or null if lookup failed)
 */
export async function enrichAddressesWithCities(
  addresses: string[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()

  // Process in parallel but with reasonable concurrency
  const BATCH_SIZE = 10
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)
    const promises = batch.map(async (address) => {
      const city = await getCityFromAddress(address)
      results.set(address, city)
    })
    await Promise.all(promises)
  }

  return results
}
