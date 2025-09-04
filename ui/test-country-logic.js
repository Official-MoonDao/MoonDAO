// Test the country extraction logic
function extractCountryFromAddress(formattedAddress) {
  if (!formattedAddress) return 'Unknown'
  
  // Handle special case of Antarctica
  if (formattedAddress === 'Antarctica') return 'Antarctica'
  
  // Split by comma and get the last part, which is typically the country
  const parts = formattedAddress.split(',').map(part => part.trim())
  if (parts.length === 0) return 'Unknown'
  
  // Return the last part as the country
  const country = parts[parts.length - 1]
  
  // Handle common country code mappings
  const countryMappings = {
    'USA': 'United States',
    'US': 'United States',
    'UK': 'United Kingdom',
    'UAE': 'United Arab Emirates'
  }
  
  return countryMappings[country] || country
}

function countUniqueCountries(locations) {
  if (!locations) return 0
  const countries = new Set(locations.map((loc) => extractCountryFromAddress(loc.formattedAddress)))
  return countries.size
}

// Test with sample data
const testData = [
  { formattedAddress: 'New York, NY, USA' },
  { formattedAddress: 'London, UK' },
  { formattedAddress: 'Paris, France' },
  { formattedAddress: 'Tokyo, Japan' },
  { formattedAddress: 'Sydney, Australia' },
  { formattedAddress: 'Antarctica' },
  { formattedAddress: 'Los Angeles, CA, USA' }, // Another US location
  { formattedAddress: 'Toronto, ON, Canada' }
]

console.log('Test data:', testData.length, 'locations')
console.log('Unique countries:', countUniqueCountries(testData))

// Test each extraction
testData.forEach(item => {
  console.log(item.formattedAddress + ' -> ' + extractCountryFromAddress(item.formattedAddress))
})

// Test edge cases
console.log('\nEdge cases:')
console.log('null -> ' + extractCountryFromAddress(null))
console.log('undefined -> ' + extractCountryFromAddress(undefined))
console.log('empty string -> ' + extractCountryFromAddress(''))
console.log('single word -> ' + extractCountryFromAddress('France'))
