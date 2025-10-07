// Import necessary Synpress modules and setup
import { testWithSynpress } from '@synthetixio/synpress'
import {
  MetaMask,
  metaMaskFixtures,
  unlockForFixture,
} from '@synthetixio/synpress/playwright'
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
  //await unlockForFixture(metamaskPage, basicSetup.walletPassword)

  // Connect MetaMask to the dapp

  // Navigate to the homepage
  //await metamask.unlock({ timeout: 60000 })
  //await page.goto('/')

  // Click the connect button
  await page.locator('#sign-in-button').last().click()
  await page.locator('button:has-text("Continue with a wallet")').click()
  await page.locator('button:has-text("MetaMask")').click()

  await metamask.connectToDapp({ timeout: 90000 })
  //await metamask.confirmSignature({ timeout: 60000 })

  // Verify the connected account address
  await expect(page.locator('#privy-connect-wallet p').last()).toHaveText(
    '0xf39F...2266'
  )

  // Additional test steps can be added here, such as:
  // - Sending transactions
  // - Interacting with smart contracts
  // - Testing dapp-specific functionality
})
