import { createContext } from 'react'

const PrivyWalletContext = createContext({
  selectedWallet: 0,
  setSelectedWallet: (selectedWallet: number) => {},
})

export default PrivyWalletContext
