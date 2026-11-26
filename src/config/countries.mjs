// Countries offered in the checkout form (billing country, ISO 3166-1 alpha-2).
// A country that is NOT listed cannot place an order. This is a commercial choice: the owner must confirm the list
// with a lawyer and with Revolut's eligibility rules (docs/REVOLUT.md). Blocked countries (sanctions) are enforced
// on the server (config.blockedCountries) and are not offered here.
export const offeredCountries = [
  'FR', 'BE', 'LU', 'CH', 'DE', 'AT', 'NL', 'IE', 'ES', 'PT', 'IT', 'MT', 'CY', 'GR',
  'PL', 'CZ', 'SK', 'SI', 'HR', 'HU', 'RO', 'BG', 'SE', 'DK', 'FI', 'NO', 'EE', 'LV', 'LT', 'IS',
  'GB', 'US', 'CA', 'AU', 'NZ', 'SG', 'JP', 'AE', 'IL', 'BR', 'MX', 'CH',
].filter((c, i, a) => a.indexOf(c) === i);
