const priceNumberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 8,
  maximumSignificantDigits: 5,
  style: 'decimal',
})

export function formatPrice (price: number): string {
  return priceNumberFormat.format(price)
}

const amountNumberFormat = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  maximumFractionDigits: 8,
})

export function formatAmount (amount: number): string {
  return amountNumberFormat.format(amount)
}
