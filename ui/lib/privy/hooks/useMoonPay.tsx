export function useMoonPay() {
  function fund(wallet: any, quoteCurrencyAmount: number) {
    const fundWalletConfig = {
      currencyCode: 'ETH_ETHEREUM',
      quoteCurrencyAmount,
      paymentMethod: 'credit_debit_card',
      uiConfig: {
        accentColor: '#696FFD',
        theme: 'dark',
      },
    }

    return wallet.fund({ config: fundWalletConfig })
  }

  return fund
}
