// Import necessary Synpress modules and setup
import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../wallet-setup/basic.setup'

// Create a test instance with Synpress and MetaMask fixtures
const test = testWithSynpress(metaMaskFixtures(basicSetup))

// Extract expect function from test
const { expect } = test

// Define a basic test case
test('should connect wallet to the MetaMask Test Dapp', async ({
  context,
  page,
  metamaskPage,
  extensionId,
}) => {
  // Create a new MetaMask instance
  const metamask = new MetaMask(
    context,
    metamaskPage,
    basicSetup.walletPassword,
    extensionId
  )

  // Navigate to the homepage
  await page.goto('/')

  // Click the connect button
  await page.locator('#sign-in-button').click()

  // Connect MetaMask to the dapp
  await metamask.connectToDapp()

  // Verify the connected account address
  await expect(page.locator('#accounts')).toHaveText(
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
  )

  // Additional test steps can be added here, such as:
  // - Sending transactions
  // - Interacting with smart contracts
  // - Testing dapp-specific functionality
})
