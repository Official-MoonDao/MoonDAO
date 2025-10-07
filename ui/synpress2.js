
import { expect, chromium, errors } from '@playwright/test'
import {
  ensureCacheDirExists,
  downloadFile,
  unzipArchive,
} from '@synthetixio/synpress-cache'
import { ensureRdpPort } from '@synthetixio/synpress-core'
import { createPool } from '@viem/anvil'
import assert from 'assert'
import fs from 'fs-extra'
import path from 'path'
import { z } from 'zod'

// src/cypress/MetaMask.ts

// src/selectors/createDataTestSelector.ts
var createDataTestSelector = (dataTestId) => {
  if (dataTestId.includes(' ')) {
    throw new Error('[CreateDataTestSelector] dataTestId cannot contain spaces')
  }
  return `[data-testid="${dataTestId}"]`
}

// src/selectors/pages/HomePage/settings.ts
var SettingsSidebarMenus = /* @__PURE__ */ ((SettingsSidebarMenus4) => {
  SettingsSidebarMenus4[(SettingsSidebarMenus4['General'] = 1)] = 'General'
  SettingsSidebarMenus4[(SettingsSidebarMenus4['Advanced'] = 2)] = 'Advanced'
  return SettingsSidebarMenus4
})(SettingsSidebarMenus || {})
var sidebarMenu = (menu) =>
  `.settings-page__content__tabs .tab-bar__tab.pointer:nth-of-type(${menu})`
var resetAccount = {
  button: `${createDataTestSelector('advanced-setting-reset-account')} button`,
  confirmButton: '.modal .modal-container__footer button.btn-danger-primary',
}
var advanced = {
  // locator(showTestNetworksToggle).nth(0) -> Show conversion on test networks
  // locator(showTestNetworksToggle).nth(1) -> Show test networks
  resetAccount,
  showTestNetworksToggle: `${createDataTestSelector(
    'advanced-setting-show-testnet-conversion'
  )} .toggle-button`,
  dismissSecretRecoveryPhraseReminderToggle:
    '.settings-page__content-row:nth-of-type(11) .toggle-button',
}
var newNetworkFormContainer = '.networks-tab__add-network-form'
var newNetworkForm = {
  networkNameInput: `${newNetworkFormContainer} .form-field:nth-child(1) input`,
  rpcUrlInput: `${newNetworkFormContainer} .form-field:nth-child(2) input`,
  rpcUrlError: `${newNetworkFormContainer} .form-field:nth-child(2) .form-field__error`,
  chainIdInput: `${newNetworkFormContainer} .form-field:nth-child(3) input`,
  chainIdError: `${newNetworkFormContainer} .form-field:nth-child(3) .form-field__error`,
  symbolInput: `${createDataTestSelector('network-form-ticker')} input`,
  symbolError: createDataTestSelector('network-form-ticker-warning'),
  blockExplorerUrlInput: `${newNetworkFormContainer} .form-field:last-child input`,
  saveButton: `${newNetworkFormContainer} .networks-tab__add-network-form-footer button.btn-primary`,
}
var networks = {
  addNetworkManuallyButton: `${createDataTestSelector('add-network-manually')}`,
  newNetworkForm,
}
var settings_default = {
  SettingsSidebarMenus,
  sidebarMenu,
  advanced,
  networks,
}

// src/type/MetaMaskAbstract.ts
var MetaMaskAbstract = class {
  /**
   * @param password - The password of the MetaMask wallet.
   * @param extensionId - The extension ID of the MetaMask extension. Optional if no interaction with the dapp is required.
   *
   * @returns A new instance of the MetaMask class.
   */
  constructor(password, extensionId) {
    this.password = password
    this.extensionId = extensionId
    this.password = password
    this.extensionId = extensionId
  }
}

// src/selectors/pages/OnboardingPage/analyticsPage.ts
var analyticsPage_default = {
  optIn: createDataTestSelector('metametrics-i-agree'),
  optOut: createDataTestSelector('metametrics-no-thanks'),
}

// src/selectors/pages/OnboardingPage/getStartedPage.ts
var getStartedPage_default = {
  termsOfServiceCheckbox: createDataTestSelector('onboarding-terms-checkbox'),
  createNewWallet: createDataTestSelector('onboarding-create-wallet'),
  importWallet: createDataTestSelector('onboarding-import-wallet'),
  //importWallet: createDataTestSelector('onboarding-'),
}

// src/selectors/pages/OnboardingPage/pinExtensionPage.ts
var pinExtensionPage_default = {
  nextButton: createDataTestSelector('pin-extension-next'),
  confirmButton: createDataTestSelector('pin-extension-done'),
}

// src/selectors/pages/OnboardingPage/secretRecoveryPhrasePage.ts
var recoveryStep = {
  selectNumberOfWordsDropdown:
    '.import-srp__number-of-words-dropdown > .dropdown__select',
  selectNumberOfWordsOption: (option) => `${option}`,
  secretRecoveryPhraseWord: (index) =>
    createDataTestSelector(`import-srp__srp-word-${index}`),
  confirmSecretRecoveryPhraseButton:
    createDataTestSelector('import-srp-confirm'),
  error: '.mm-banner-alert.import-srp__srp-error div',
}
var passwordStep = {
  passwordInput: createDataTestSelector('create-password-new'),
  confirmPasswordInput: createDataTestSelector('create-password-confirm'),
  acceptTermsCheckbox: createDataTestSelector('create-password-terms'),
  importWalletButton: createDataTestSelector('create-password-import'),
  error: `${createDataTestSelector('create-password-new')} + h6 > span > span`,
}
var secretRecoveryPhrasePage_default = {
  recoveryStep,
  passwordStep,
}

// src/selectors/pages/OnboardingPage/walletCreationSuccessPage.ts
var walletCreationSuccessPage_default = {
  confirmButton: createDataTestSelector('onboarding-complete-done'),
}

// src/selectors/pages/OnboardingPage/index.ts
var OnboardingPage_default = {
  // Initial Welcome Page
  GetStartedPageSelectors: getStartedPage_default,
  // 2nd Page
  AnalyticsPageSelectors: analyticsPage_default,
  // 3rd Page with two steps:
  // - Input Secret Recovery Phrase
  // - Create Password
  SecretRecoveryPhrasePageSelectors: secretRecoveryPhrasePage_default,
  // 4th Page
  WalletCreationSuccessPageSelectors: walletCreationSuccessPage_default,
  // 5th Page
  PinExtensionPageSelectors: pinExtensionPage_default,
}

// src/selectors/pages/HomePage/index.ts
var accountMenuContainer = '.multichain-account-menu-popover'
var addNewAccountMenu = {
  accountNameInput: `${accountMenuContainer} input`,
  createButton: `${accountMenuContainer} button.mm-button-primary`,
}
var renameAccountMenu = {
  listItemButton: `${accountMenuContainer} ${createDataTestSelector(
    'account-list-item-menu-button'
  )}`,
  renameButton: `${createDataTestSelector('editable-label-button')}`,
  confirmRenameButton: 'div.editable-label button.mm-button-icon',
  renameInput: '.mm-text-field .mm-box--padding-right-4',
}
var importAccountMenu = {
  privateKeyInput: `${accountMenuContainer} input#private-key-box`,
  importButton: `${accountMenuContainer} ${createDataTestSelector(
    'import-account-confirm-button'
  )}`,
  error: `${accountMenuContainer} p.mm-form-text-field__help-text`,
}
var addAccountMenu = {
  addAccountButton: `${accountMenuContainer} ${createDataTestSelector(
    'multichain-account-menu-popover-action-button'
  )}`,
  addNewAccountButton: `${accountMenuContainer} ${createDataTestSelector(
    'multichain-account-menu-popover-add-account'
  )}`,
  importAccountButton: `${accountMenuContainer} div.mm-box.mm-box--padding-4:nth-child(2) > div.mm-box:nth-child(2) > button`,
  addNewAccountMenu,
  importAccountMenu,
}
var accountMenu = {
  accountButton: createDataTestSelector('account-menu-icon'),
  accountNames: `${accountMenuContainer} .multichain-account-menu-popover__list .multichain-account-list-item__account-name__button`,
  addAccountMenu,
  renameAccountMenu,
}
var threeDotsMenu = {
  threeDotsButton: createDataTestSelector('account-options-menu-button'),
  settingsButton: createDataTestSelector('global-menu-settings'),
  lockButton: createDataTestSelector('global-menu-lock'),
  accountDetailsButton: createDataTestSelector('account-list-menu-details'),
  accountDetailsCloseButton:
    '.mm-modal-content .mm-modal-header button.mm-button-icon.mm-button-icon--size-sm',
}
var popoverContainer = '.popover-container'
var popover = {
  closeButton: `${popoverContainer} ${createDataTestSelector('popover-close')}`,
}
var networkAddedPopover = {
  switchToNetworkButton: '.home__new-network-added__switch-to-button',
  dismissButton: '.home__new-network-added button.btn-secondary',
  switchCompleteCloseButton:
    '.popover-header .box.popover-header__title button.mm-box.mm-button-icon',
}
var newNetworkInfoPopover = {
  gotItButton: '.new-network-info__wrapper button.btn-primary',
}
var recoveryPhraseReminder = {
  gotItButton: '.recovery-phrase-reminder button.btn-primary',
}
var networkDropdownContainer = '.multichain-network-list-menu-content-wrapper'
var networkDropdown = {
  dropdownButton: createDataTestSelector('network-display'),
  closeDropdownButton: `${networkDropdownContainer} > section > div:nth-child(1) button`,
  networksList: `${networkDropdownContainer} .multichain-network-list-menu`,
  networks: `${networkDropdownContainer} .multichain-network-list-item p`,
  showTestNetworksToggle: `${networkDropdownContainer} > section > div > label.toggle-button`,
  addNetworkButton: `${networkDropdownContainer} div.mm-box.mm-box--padding-4 > button`,
  toggleOff: `${networkDropdownContainer} label.toggle-button.toggle-button--off`,
  toggleOn: `${networkDropdownContainer} label.toggle-button.toggle-button--on`,
  closeNetworkPopupButton:
    '.mm-modal-header button.mm-button-icon.mm-box--color-icon-default.mm-box--background-color-transparent.mm-box--rounded-lg',
}
var tabContainer = '.tabs__content'
var activityTab = {
  activityTabButton: `${createDataTestSelector('home__activity-tab')}`,
  transactionsList: `${tabContainer} .transaction-list__transactions`,
  pendingQueuedTransactions: `${tabContainer} .transaction-list__pending-transactions .transaction-list-item .transaction-status-label--queued`,
  pendingUnapprovedTransactions: `${tabContainer} .transaction-list__pending-transactions .transaction-list-item .transaction-status-label--unapproved`,
  pendingApprovedTransactions: `${tabContainer} .transaction-list__pending-transactions .transaction-list-item .transaction-status-label--pending`,
  completedTransactions: `${tabContainer} .transaction-list__completed-transactions .transaction-list-item`,
}
var singleToken = '.multichain-token-list-item'
var HomePage_default = {
  logo: `button${createDataTestSelector('app-header-logo')}`,
  copyAccountAddressButton: createDataTestSelector('address-copy-button-text'),
  currentNetwork: `${createDataTestSelector(
    'network-display'
  )} span:nth-of-type(1)`,
  threeDotsMenu,
  settings: settings_default,
  activityTab,
  networkDropdown,
  accountMenu,
  recoveryPhraseReminder,
  popover,
  networkAddedPopover,
  newNetworkInfoPopover,
  portfolio: {
    singleToken,
  },
}

// src/selectors/loading/index.ts
var LoadingSelectors = {
  spinner: '.spinner',
  loadingOverlay: '.loading-overlay',
  loadingIndicators: [
    '.loading-logo',
    '.loading-spinner',
    '.loading-overlay',
    '.loading-overlay__spinner',
    '.loading-span',
    '.loading-indicator',
    '#loading__logo',
    '#loading__spinner',
    '.mm-button-base__icon-loading',
    '.loading-swaps-quotes',
    '.loading-heartbeat',
  ],
}

// src/selectors/pages/CrashPage/index.ts
var container = 'section.error-page'
var CrashPage_default = {
  header: `${container} > .error-page__header`,
  errors: `${container} > .error-page__details li`,
}

// src/selectors/pages/LockPage/index.ts
var LockPage_default = {
  passwordInput: createDataTestSelector('unlock-password'),
  submitButton: createDataTestSelector('unlock-submit'),
}

// src/selectors/pages/NotificationPage/actionFooter.ts
var actionFooter_default = {
  confirmActionButton: `.page-container__footer ${createDataTestSelector(
    'page-container-footer-next'
  )}`,
  rejectActionButton: `.page-container__footer ${createDataTestSelector(
    'page-container-footer-cancel'
  )}`,
}

// src/selectors/pages/NotificationPage/connectPage.ts
var connectPage_default = {
  accountOption:
    '.choose-account-list .choose-account-list__list .choose-account-list__account',
  accountCheckbox: 'input.choose-account-list__list-check-box',
}

// src/selectors/pages/NotificationPage/ethereumRpcPage.ts
var ethereumRpcPage_default = {
  approveNewRpc:
    '.confirmation-warning-modal__content .mm-button-primary--type-danger',
  rejectNewRpc: '.confirmation-warning-modal__content .mm-button-secondary',
}

// src/selectors/pages/NotificationPage/networkPage.ts
var addNetwork = {
  approveButton: '.confirmation-footer__actions button.btn-primary',
  cancelButton: '.confirmation-footer__actions button.btn-secondary',
}
var switchNetwork = {
  switchNetworkButton: '.confirmation-footer__actions button.btn-primary',
  cancelButton: '.confirmation-footer__actions button.btn-secondary',
}
var networkPage_default = {
  addNetwork,
  switchNetwork,
}

// src/selectors/pages/NotificationPage/permissionPage.ts
var approve = {
  maxButton: createDataTestSelector('custom-spending-cap-max-button'),
  customSpendingCapInput: createDataTestSelector('custom-spending-cap-input'),
}
var permissionPage_default = {
  approve,
}

// src/selectors/pages/NotificationPage/signaturePage.ts
var simpleMessage = {
  signButton: `.request-signature__footer ${createDataTestSelector(
    'request-signature__sign'
  )}`,
  rejectButton: '.request-signature__footer button.btn-secondary',
}
var structuredMessage = {
  scrollDownButton: `.signature-request-message ${createDataTestSelector(
    'signature-request-scroll-button'
  )}`,
  signButton: `.signature-request-footer ${createDataTestSelector(
    'signature-sign-button'
  )}`,
  rejectButton: `.signature-request-footer ${createDataTestSelector(
    'signature-cancel-button'
  )}`,
}
var riskModal = {
  signButton: createDataTestSelector('signature-warning-sign-button'),
}
var signaturePage_default = {
  simpleMessage,
  structuredMessage,
  riskModal,
}

// src/selectors/pages/NotificationPage/transactionPage.ts
var advancedGasFeeMenu = {
  maxBaseFeeInput: createDataTestSelector('base-fee-input'),
  priorityFeeInput: createDataTestSelector('priority-fee-input'),
  gasLimitEditButton: createDataTestSelector('advanced-gas-fee-edit'),
  gasLimitInput: createDataTestSelector('gas-limit-input'),
  gasLimitError: `div:has(> ${createDataTestSelector(
    'gas-limit-input'
  )}) + .form-field__error`,
  saveButton: '.popover-footer > button.btn-primary',
}
var lowGasFee = {
  button: createDataTestSelector('edit-gas-fee-item-low'),
  maxFee: `${createDataTestSelector(
    'edit-gas-fee-item-low'
  )} .edit-gas-item__fee-estimate`,
}
var marketGasFee = {
  button: createDataTestSelector('edit-gas-fee-item-medium'),
  maxFee: `${createDataTestSelector(
    'edit-gas-fee-item-medium'
  )} .edit-gas-item__fee-estimate`,
}
var aggressiveGasFee = {
  button: createDataTestSelector('edit-gas-fee-item-high'),
  maxFee: `${createDataTestSelector(
    'edit-gas-fee-item-high'
  )} .edit-gas-item__fee-estimate`,
}
var editGasFeeMenu = {
  editGasFeeButton: createDataTestSelector('edit-gas-fee-icon'),
  editGasFeeButtonToolTip: '.edit-gas-fee-button .info-tooltip',
  lowGasFee,
  marketGasFee,
  aggressiveGasFee,
  siteSuggestedGasFeeButton: createDataTestSelector(
    'edit-gas-fee-item-dappSuggested'
  ),
  advancedGasFeeButton: createDataTestSelector('edit-gas-fee-item-custom'),
  advancedGasFeeMenu,
}
var nftApproveAllConfirmationPopup = {
  approveButton:
    '.set-approval-for-all-warning__content button.set-approval-for-all-warning__footer__approve-button',
}
var transactionPage_default = {
  editGasFeeMenu,
  nftApproveAllConfirmationPopup,
}

// src/selectors/pages/NotificationPage/index.ts
var NotificationPage_default = {
  ActionFooter: actionFooter_default,
  ConnectPage: connectPage_default,
  EthereumRpcPage: ethereumRpcPage_default,
  NetworkPage: networkPage_default,
  PermissionPage: permissionPage_default,
  SignaturePage: signaturePage_default,
  TransactionPage: transactionPage_default,
}

// src/selectors/pages/SettingsPage/index.ts
var menuOption = '.settings-page__content__tabs .tab-bar .tab-bar__tab'
var settings = {
  menuOption,
  advancedSettings: `${menuOption}:nth-child(2)`,
  ethSignToggle: `${createDataTestSelector(
    'advanced-setting-toggle-ethsign'
  )} .eth-sign-toggle`,
  ethSignWarning:
    '.settings-page__content-row .mm-banner-alert.mm-banner-alert--severity-danger.mm-box--background-color-error-muted',
}
var confirmationModal = {
  confirmationCheckbox: createDataTestSelector('eth-sign__checkbox'),
  continueButton: '.modal__content button.mm-button-primary',
  manualConfirmationInput: '#enter-eth-sign-text',
  enableButton:
    '.modal__content button.mm-button-primary.mm-button-primary--type-danger',
}
var SettingsPage_default = {
  settings,
  confirmationModal,
}

// src/playwright/utils/waitFor.ts
var DEFAULT_TIMEOUT = 1e4
var waitUntilStable = async (page) => {
  await page.waitForLoadState('domcontentloaded', { timeout: DEFAULT_TIMEOUT })
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT })
}
var waitForSelector = async (selector, page, timeout) => {
  await waitUntilStable(page)
  try {
    await page.waitForSelector(selector, { state: 'hidden', timeout })
  } catch (error) {
    if (error instanceof errors.TimeoutError) {
      console.log(`Loading indicator '${selector}' not found - continuing.`)
    } else {
      console.log(
        `Error while waiting for loading indicator '${selector}' to disappear`
      )
      throw error
    }
  }
}
var waitForMetaMaskLoad = async (page) => {
  try {
    await waitUntilStable(page)
    await Promise.all(
      LoadingSelectors.loadingIndicators.map(async (selector) => {
        await waitForSelector(selector, page, DEFAULT_TIMEOUT)
      })
    )
  } catch (error) {
    console.warn('Warning during MetaMask load:', error)
  }
  await sleep(300)
  return page
}
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
var timeouts = [0, 20, 50, 100, 100, 500]
async function waitFor(action, timeout, shouldThrow = true) {
  let timeoutsSum = 0
  let timeoutIndex = 0
  let reachedTimeout = false
  while (!reachedTimeout) {
    let nextTimeout = timeouts.at(Math.min(timeoutIndex++, timeouts.length - 1))
    if (timeoutsSum + nextTimeout > timeout) {
      nextTimeout = timeout - timeoutsSum
      reachedTimeout = true
    } else {
      timeoutsSum += nextTimeout
    }
    await sleep(nextTimeout)
    const result = await action()
    if (result) {
      return result
    }
  }
  if (shouldThrow) {
    throw new Error(`Timeout ${timeout}ms exceeded.`)
  }
  return false
}

// src/playwright/utils/clickLocatorIfCondition.ts
async function clickLocatorIfCondition(locator, condition, timeout = 3e3) {
  const shouldClick = await waitFor(condition, timeout, false)
  if (shouldClick) {
    await locator.click({ force: true })
  }
}

// src/playwright/pages/HomePage/actions/popups/closePopover.ts
async function closePopover(page) {
  const closeButtonLocator = page
    .locator(HomePage_default.popover.closeButton)
    .first()
  await clickLocatorIfCondition(
    closeButtonLocator,
    () => closeButtonLocator.isVisible(),
    1e3
  )
}

// src/playwright/pages/HomePage/actions/popups/closeRecoveryPhraseReminder.ts
async function closeRecoveryPhraseReminder(page) {
  const closeButtonLocator = page
    .locator(HomePage_default.recoveryPhraseReminder.gotItButton)
    .first()
  await clickLocatorIfCondition(
    closeButtonLocator,
    () => closeButtonLocator.isVisible(),
    1e3
  )
}

// src/playwright/pages/HomePage/actions/popups/closeNewNetworkInfoPopover.ts
async function closeNewNetworkInfoPopover(page) {
  const gotItButtonLocator = page
    .locator(HomePage_default.newNetworkInfoPopover.gotItButton)
    .first()
  await clickLocatorIfCondition(
    gotItButtonLocator,
    () => gotItButtonLocator.isVisible(),
    1e3
  )
}

// src/playwright/pages/HomePage/actions/popups/closeNetworkAddedPopover.ts
async function closeNetworkAddedPopover(page) {
  const switchNetworkButtonLocator = page.locator(
    HomePage_default.networkAddedPopover.switchToNetworkButton
  )
  await clickLocatorIfCondition(
    switchNetworkButtonLocator,
    () => switchNetworkButtonLocator.isVisible(),
    1e3
  )
  const switchCompleteCloseButtonLocator = page.locator(
    HomePage_default.networkAddedPopover.switchCompleteCloseButton
  )
  await clickLocatorIfCondition(
    switchCompleteCloseButtonLocator,
    () => switchCompleteCloseButtonLocator.isVisible(),
    1e3
  )
}

// src/playwright/pages/HomePage/actions/popups/closeWhatsNewPopover.ts
async function closeWhatsNewPopover(page) {
  const closeButtonLocator = page.locator('[aria-label="Close"]').first()
  await clickLocatorIfCondition(
    closeButtonLocator,
    () => closeButtonLocator.isVisible(),
    1e3
  )
}

// src/playwright/pages/HomePage/actions/lock.ts
async function lock(page) {
  await page.locator(HomePage_default.threeDotsMenu.threeDotsButton).click()
  await page.locator(HomePage_default.threeDotsMenu.lockButton).click()
}

// src/playwright/pages/HomePage/actions/importWalletFromPrivateKey.ts
async function importWalletFromPrivateKey(page, privateKey) {
  await page.locator(HomePage_default.accountMenu.accountButton).click()
  await page
    .locator(HomePage_default.accountMenu.addAccountMenu.addAccountButton)
    .click()
  await page
    .locator(HomePage_default.accountMenu.addAccountMenu.importAccountButton)
    .click()
  await page
    .locator(
      HomePage_default.accountMenu.addAccountMenu.importAccountMenu
        .privateKeyInput
    )
    .fill(privateKey)
  const importButton = page.locator(
    HomePage_default.accountMenu.addAccountMenu.importAccountMenu.importButton
  )
  await importButton.click()
  const isImportButtonHidden = await waitFor(
    () => importButton.isHidden(),
    1e3,
    false
  )
  if (!isImportButtonHidden) {
    const errorText = await page
      .locator(
        HomePage_default.accountMenu.addAccountMenu.importAccountMenu.error
      )
      .textContent({
        timeout: 1e3,
        // TODO: Extract & make configurable
      })
    throw new Error(
      `[ImportWalletFromPrivateKey] Importing failed due to error: ${errorText}`
    )
  }
}
async function allTextContents(locators) {
  const names = await Promise.all(
    locators.map((locator) => locator.textContent())
  )
  return names.map((name) => z.string().parse(name))
}

// src/playwright/pages/HomePage/actions/switchAccount.ts
async function switchAccount(page, accountName) {
  await page.locator(HomePage_default.accountMenu.accountButton).click()
  const accountNamesLocators = await page
    .locator(HomePage_default.accountMenu.accountNames)
    .all()
  const accountNames = await allTextContents(accountNamesLocators)
  const seekedAccountNames = accountNames.filter(
    (name) => name.toLocaleLowerCase() === accountName.toLocaleLowerCase()
  )
  if (seekedAccountNames.length === 0) {
    throw new Error(
      `[SwitchAccount] Account with name ${accountName} not found`
    )
  }
  const accountIndex = accountNames.indexOf(seekedAccountNames[0])
  await accountNamesLocators[accountIndex].click()
}

// src/playwright/utils/toggle.ts
async function toggle(toggleLocator) {
  const classes = await toggleLocator.getAttribute('class', { timeout: 1e4 })
  if (!classes) {
    throw new Error('[ToggleShowTestNetworks] Toggle class returned null')
  }
  const isOn = classes.includes('toggle-button--on')
  await toggleLocator.click()
  const waitForAction = async () => {
    const classes2 = await toggleLocator.getAttribute('class')
    if (!classes2) {
      throw new Error(
        '[ToggleShowTestNetworks] Toggle class returned null inside waitFor'
      )
    }
    if (isOn) {
      return classes2.includes('toggle-button--off')
    }
    return classes2.includes('toggle-button--on')
  }
  await waitFor(waitForAction, 1e4, true)
}

// src/playwright/pages/HomePage/actions/settings.ts
async function openSettings(page) {
  await page.locator(HomePage_default.threeDotsMenu.threeDotsButton).click()
  await page.locator(HomePage_default.threeDotsMenu.settingsButton).click()
}
async function openSidebarMenu(page, menu) {
  await page.locator(HomePage_default.settings.sidebarMenu(menu)).click()
}
async function resetAccount2(page) {
  const buttonSelector = `[data-testid="advanced-setting-reset-account"] button`
  const confirmButtonSelector =
    '.modal .modal-container__footer button.btn-danger-primary'
  await page.locator(buttonSelector).click()
  await page.locator(confirmButtonSelector).click()
}
async function toggleDismissSecretRecoveryPhraseReminder(page) {
  const toggleLocator = page.locator(
    HomePage_default.settings.advanced.dismissSecretRecoveryPhraseReminderToggle
  )
  await toggle(toggleLocator)
}
var advanced2 = {
  resetAccount: resetAccount2,
  toggleDismissSecretRecoveryPhraseReminder,
}
var settings2 = {
  openSettings,
  openSidebarMenu,
  advanced: advanced2,
}

// src/playwright/pages/HomePage/actions/switchNetwork.ts
async function openTestnetSection(page) {
  const toggleButtonLocator = page.locator(
    HomePage_default.networkDropdown.showTestNetworksToggle
  )
  const classes = await toggleButtonLocator.getAttribute('class')
  if (classes?.includes('toggle-button--off')) {
    await toggleButtonLocator.click()
    await page.locator(HomePage_default.networkDropdown.toggleOn).isChecked()
  }
}
async function switchNetwork2(page, networkName, includeTestNetworks) {
  await page.locator(HomePage_default.networkDropdown.dropdownButton).click()
  if (includeTestNetworks) {
    await openTestnetSection(page)
  }
  const networkLocators = await page
    .locator(HomePage_default.networkDropdown.networks)
    .all()
  const networkNames = await allTextContents(networkLocators)
  const seekedNetworkNameIndex = networkNames.findIndex(
    (name) => name.toLocaleLowerCase() === networkName.toLocaleLowerCase()
  )
  const seekedNetworkLocator =
    seekedNetworkNameIndex >= 0 && networkLocators[seekedNetworkNameIndex]
  if (!seekedNetworkLocator) {
    throw new Error(
      `[SwitchNetwork] Network with name ${networkName} not found`
    )
  }
  await seekedNetworkLocator.click()
  await closeNewNetworkInfoPopover(page)
  await closeWhatsNewPopover(page)
  await closeRecoveryPhraseReminder(page)
}
var NetworkValidation = z.object({
  name: z.string(),
  rpcUrl: z.string(),
  chainId: z.number(),
  symbol: z.string(),
  blockExplorerUrl: z.string().optional(),
})

// src/playwright/pages/HomePage/actions/addNetwork.ts
async function addNetwork2(page, network2) {
  const { name, rpcUrl, chainId, symbol, blockExplorerUrl } =
    NetworkValidation.parse(network2)
  await page.locator(HomePage_default.networkDropdown.dropdownButton).click()
  await page.locator(HomePage_default.networkDropdown.addNetworkButton).click()
  await page
    .locator(HomePage_default.settings.networks.addNetworkManuallyButton)
    .click()
  await page
    .locator(HomePage_default.settings.networks.newNetworkForm.networkNameInput)
    .fill(name)
  await page
    .locator(HomePage_default.settings.networks.newNetworkForm.rpcUrlInput)
    .fill(rpcUrl)
  const rpcUrlErrorLocator = page.locator(
    HomePage_default.settings.networks.newNetworkForm.rpcUrlError
  )
  if (await waitFor(() => rpcUrlErrorLocator.isVisible(), 1e3, false)) {
    const rpcUrlErrorText = await rpcUrlErrorLocator.textContent({
      timeout: 1e3,
    })
    throw new Error(`[AddNetwork] RPC URL error: ${rpcUrlErrorText}`)
  }
  await page
    .locator(HomePage_default.settings.networks.newNetworkForm.chainIdInput)
    .fill(chainId.toString())
  const chainIdErrorLocator = page.locator(
    HomePage_default.settings.networks.newNetworkForm.chainIdError
  )
  if (await waitFor(() => chainIdErrorLocator.isVisible(), 1e3, false)) {
    const chainIdErrorText = await chainIdErrorLocator.textContent({
      timeout: 1e3,
    })
    throw new Error(`[AddNetwork] Chain ID error: ${chainIdErrorText}`)
  }
  await page
    .locator(HomePage_default.settings.networks.newNetworkForm.symbolInput)
    .fill(symbol)
  await waitFor(
    async () =>
      page
        .locator(HomePage_default.settings.networks.newNetworkForm.symbolError)
        .isVisible(),
    1e3,
    false
  )
  if (blockExplorerUrl) {
    await page
      .locator(
        HomePage_default.settings.networks.newNetworkForm.blockExplorerUrlInput
      )
      .fill(blockExplorerUrl)
  }
  await page
    .locator(HomePage_default.settings.networks.newNetworkForm.saveButton)
    .click()
  await closeNetworkAddedPopover(page)
  await closeNewNetworkInfoPopover(page)
}

// src/playwright/pages/HomePage/actions/toggleShowTestNetworks.ts
async function toggleShowTestNetworks(page) {
  await page.locator(HomePage_default.networkDropdown.dropdownButton).click()
  await toggle(
    page.locator(HomePage_default.networkDropdown.showTestNetworksToggle)
  )
  await page
    .locator(HomePage_default.networkDropdown.closeNetworkPopupButton)
    .click()
}

// src/playwright/pages/HomePage/actions/addNewAccount.ts
async function addNewAccount(page, accountName) {
  if (accountName.length === 0) {
    throw new Error('[AddNewAccount] Account name cannot be an empty string')
  }
  await page.locator(HomePage_default.accountMenu.accountButton).click()
  await page
    .locator(HomePage_default.accountMenu.addAccountMenu.addAccountButton)
    .click()
  await page
    .locator(HomePage_default.accountMenu.addAccountMenu.addNewAccountButton)
    .click()
  await page
    .locator(
      HomePage_default.accountMenu.addAccountMenu.addNewAccountMenu
        .accountNameInput
    )
    .fill(accountName)
  await page
    .locator(
      HomePage_default.accountMenu.addAccountMenu.addNewAccountMenu.createButton
    )
    .click()
}

// src/playwright/pages/HomePage/actions/transactionDetails.ts
var openTransactionDetails = async (page, txIndex) => {
  await page.locator(HomePage_default.activityTab.activityTabButton).click()
  const visibleTxs = await page
    .locator(HomePage_default.activityTab.completedTransactions)
    .count()
  if (txIndex >= visibleTxs) {
    throw new Error(
      `[OpenTransactionDetails] Transaction with index ${txIndex} is not visible. There are only ${visibleTxs} transactions visible.`
    )
  }
  await page
    .locator(HomePage_default.activityTab.completedTransactions)
    .nth(txIndex)
    .click()
  await waitFor(
    () =>
      page.locator(HomePage_default.popover.closeButton).first().isVisible(),
    3e3
  )
}
var closeTransactionDetails = async (page) => {
  await page.locator(HomePage_default.popover.closeButton).first().click()
}
var transactionDetails = {
  open: openTransactionDetails,
  close: closeTransactionDetails,
}

// src/playwright/pages/HomePage/actions/renameAccount.ts
async function renameAccount(page, currentAccountName, newAccountName) {
  await page.locator(HomePage_default.accountMenu.accountButton).click()
  const accountNamesLocators = await page
    .locator(HomePage_default.accountMenu.accountNames)
    .all()
  const accountNames = await allTextContents(accountNamesLocators)
  const seekedAccountNames = accountNames.filter(
    (name) =>
      name.toLocaleLowerCase() === currentAccountName.toLocaleLowerCase()
  )
  if (seekedAccountNames.length === 0) {
    throw new Error(
      `[SwitchAccount] Account with name ${currentAccountName} not found`
    )
  }
  const accountIndex = accountNames.indexOf(seekedAccountNames[0])
  await page
    .locator(HomePage_default.accountMenu.renameAccountMenu.listItemButton)
    .nth(accountIndex)
    .click()
  await page
    .locator(HomePage_default.threeDotsMenu.accountDetailsButton)
    .click()
  await page
    .locator(HomePage_default.accountMenu.renameAccountMenu.renameButton)
    .click()
  await page
    .locator(HomePage_default.accountMenu.renameAccountMenu.renameInput)
    .fill(newAccountName)
  await page
    .locator(HomePage_default.accountMenu.renameAccountMenu.confirmRenameButton)
    .click()
}

// src/playwright/pages/HomePage/actions/getAccountAddress.ts
async function getAccountAddress(page) {
  await page.locator(HomePage_default.threeDotsMenu.threeDotsButton).click()
  await page
    .locator(HomePage_default.threeDotsMenu.accountDetailsButton)
    .click()
  const account = await page
    .locator(HomePage_default.copyAccountAddressButton)
    .last()
    .innerText()
  await page
    .locator(HomePage_default.threeDotsMenu.accountDetailsCloseButton)
    .click()
  return account
}

// src/playwright/pages/OnboardingPage/actions/helpers/confirmSecretRecoveryPhrase.ts
var StepSelectors =
  OnboardingPage_default.SecretRecoveryPhrasePageSelectors.recoveryStep
async function confirmSecretRecoveryPhrase(page, seedPhrase) {
  const seedPhraseWords = seedPhrase.split(' ')
  const seedPhraseLength = seedPhraseWords.length
  await page
    .locator(StepSelectors.selectNumberOfWordsDropdown)
    .selectOption(StepSelectors.selectNumberOfWordsOption(seedPhraseLength))
  for (const [index, word] of seedPhraseWords.entries()) {
    await page.locator(StepSelectors.secretRecoveryPhraseWord(index)).fill(word)
  }
  const confirmSRPButton = page.locator(
    StepSelectors.confirmSecretRecoveryPhraseButton
  )
  if (await confirmSRPButton.isDisabled()) {
    const errorText = await page.locator(StepSelectors.error).textContent({
      timeout: 1e3,
    })
    throw new Error(
      `[ConfirmSecretRecoveryPhrase] Invalid seed phrase. Error from MetaMask: ${errorText}`
    )
  }
  await confirmSRPButton.click()
}

// src/playwright/pages/OnboardingPage/actions/helpers/createPassword.ts
var StepSelectors2 =
  OnboardingPage_default.SecretRecoveryPhrasePageSelectors.passwordStep
async function createPassword(page, password) {
  await page.locator(StepSelectors2.passwordInput).fill(password)
  await page.locator(StepSelectors2.confirmPasswordInput).fill(password)
  await page.locator(StepSelectors2.acceptTermsCheckbox).click()
  const importWalletButton = page.locator(StepSelectors2.importWalletButton)
  if (await importWalletButton.isDisabled()) {
    const errorText = await page.locator(StepSelectors2.error).textContent({
      timeout: 1e3,
    })
    throw new Error(
      `[CreatePassword] Invalid password. Error from MetaMask: ${errorText}`
    )
  }
  await importWalletButton.click()
}

// src/playwright/pages/OnboardingPage/actions/importWallet.ts
async function importWallet(page, seedPhrase, password) {
  //await page.locator(OnboardingPage_default.GetStartedPageSelectors.termsOfServiceCheckbox).click();
  await page
    .locator(OnboardingPage_default.GetStartedPageSelectors.importWallet)
    .click()
  //await page
  //.locator(OnboardingPage_default.AnalyticsPageSelectors.optOut)
  //.click()
  await page
    .locator(OnboardingPage_default.GetStartedPageSelectors.importWallet)
    .click()
  await confirmSecretRecoveryPhrase(page, seedPhrase)
  await createPassword(page, password)
  await page
    .locator(
      OnboardingPage_default.WalletCreationSuccessPageSelectors.confirmButton
    )
    .click()
  await page
    .locator(OnboardingPage_default.PinExtensionPageSelectors.nextButton)
    .click()
  await page
    .locator(OnboardingPage_default.PinExtensionPageSelectors.confirmButton)
    .click()
  await closeNewNetworkInfoPopover(page)
  await closePopover(page)
  await closeWhatsNewPopover(page)
  await verifyImportedWallet(page)
}
async function verifyImportedWallet(page) {
  const accountAddress = await page
    .locator(HomePage_default.copyAccountAddressButton)
    .textContent()
  assert.strictEqual(
    accountAddress?.startsWith('0x'),
    true,
    new Error(
      [
        `Incorrect state after importing the seed phrase. Account address is expected to start with "0x", but got "${accountAddress}" instead.`,
        'Note: Try to re-run the cache creation. This is a known but rare error where MetaMask hangs during the onboarding process. If it persists, please file an issue on GitHub.',
      ].join('\n')
    )
  )
}

// src/playwright/pages/OnboardingPage/page.ts
var OnboardingPage = class {
  static selectors = OnboardingPage_default
  selectors = OnboardingPage_default
  page
  constructor(page) {
    this.page = page
  }
  async importWallet(seedPhrase, password) {
    return await importWallet(this.page, seedPhrase, password)
  }
}

// src/playwright/pages/CrashPage/page.ts
var CrashPage = class {
  static selectors = CrashPage_default
  selectors = CrashPage_default
}

// src/playwright/utils/waitForSpinnerToVanish.ts
var DEFAULT_TIMEOUT2 = 1e4
async function waitForSpinnerToVanish(page) {
  await page.locator(LoadingSelectors.spinner).waitFor({
    state: 'hidden',
    timeout: DEFAULT_TIMEOUT2,
  })
}

// src/playwright/pages/LockPage/actions/unlock.ts
async function unlock(page, password) {
  await page.locator(LockPage_default.passwordInput).fill(password)
  await page.locator(LockPage_default.submitButton).click()
  await waitForSpinnerToVanish(page)
}

// src/playwright/pages/LockPage/page.ts
var LockPage = class {
  static selectors = LockPage_default
  selectors = LockPage_default
  page
  constructor(page) {
    this.page = page
  }
  async unlock(password) {
    await unlock(this.page, password)
  }
}

// src/playwright/pages/HomePage/page.ts
var HomePage = class {
  static selectors = HomePage_default
  selectors = HomePage_default
  page
  constructor(page) {
    this.page = page
  }
  async goBackToHomePage() {
    await this.page.locator(HomePage_default.logo).click()
  }
  async lock() {
    await lock(this.page)
  }
  async addNewAccount(accountName) {
    await addNewAccount(this.page, accountName)
  }
  async renameAccount(currentAccountName, newAccountName) {
    await renameAccount(this.page, currentAccountName, newAccountName)
  }
  async getAccountAddress() {
    return await getAccountAddress(this.page)
  }
  async importWalletFromPrivateKey(privateKey) {
    await importWalletFromPrivateKey(this.page, privateKey)
  }
  async switchAccount(accountName) {
    await switchAccount(this.page, accountName)
  }
  async openSettings() {
    await settings2.openSettings(this.page)
  }
  async openSidebarMenu(menu) {
    await settings2.openSidebarMenu(this.page, menu)
  }
  async toggleShowTestNetworks() {
    await toggleShowTestNetworks(this.page)
  }
  async resetAccount() {
    await settings2.advanced.resetAccount(this.page)
  }
  async toggleDismissSecretRecoveryPhraseReminder() {
    await settings2.advanced.toggleDismissSecretRecoveryPhraseReminder(
      this.page
    )
  }
  async switchNetwork(networkName, isTestnet) {
    await switchNetwork2(this.page, networkName, isTestnet)
  }
  async addNetwork(network2) {
    await addNetwork2(this.page, network2)
  }
  async openTransactionDetails(txIndex) {
    await transactionDetails.open(this.page, txIndex)
  }
  async closeTransactionDetails() {
    await transactionDetails.close(this.page)
  }
}
var sleep2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
var NOTIFICATION_PAGE_TIMEOUT = 1e4
async function getNotificationPageAndWaitForLoad(
  context2,
  extensionId,
  maxRetries = 2
) {
  const notificationPageUrl = `chrome-extension://${extensionId}/notification.html`
  const isNotificationPage = (page) => page.url().includes(notificationPageUrl)
  let retries = 0
  let notificationPage
  while (retries <= maxRetries) {
    try {
      notificationPage = context2.pages().find(isNotificationPage)
      if (!notificationPage) {
        notificationPage = await context2.waitForEvent('page', {
          predicate: isNotificationPage,
          timeout: NOTIFICATION_PAGE_TIMEOUT,
        })
      }
      await waitUntilStable(notificationPage)
      await notificationPage.setViewportSize({
        width: 360,
        height: 592,
      })
      try {
        await positionWindowWithCDP(notificationPage)
      } catch (positionError) {
        console.warn(
          `[getNotificationPageAndWaitForLoad] CDP positioning failed: ${positionError}. Trying alternative method.`
        )
        try {
          await notificationPage.evaluate(() => {
            window.moveTo(50, 50)
            if (
              window.screenX > window.screen.availWidth - 400 ||
              window.screenY > window.screen.availHeight - 650
            ) {
              window.moveTo(
                Math.min(50, window.screen.availWidth - 400),
                Math.min(50, window.screen.availHeight - 650)
              )
            }
          })
        } catch (fallbackError) {
          console.warn(
            `[getNotificationPageAndWaitForLoad] Fallback positioning also failed: ${fallbackError}`
          )
        }
      }
      return await waitForMetaMaskLoad(notificationPage)
    } catch (error) {
      console.log('error', error)
      retries++
      if (retries <= maxRetries) {
        console.warn(
          `[getNotificationPageAndWaitForLoad] Failed to get notification page, retrying (attempt ${retries}/${maxRetries})...`
        )
        console.warn('error')
        console.warn(error)
        await sleep2(1e3 * retries)
        continue
      }
      if (error instanceof errors.TimeoutError) {
        throw new Error(
          `[getNotificationPageAndWaitForLoad] Notification page did not appear after ${NOTIFICATION_PAGE_TIMEOUT}ms and ${maxRetries} retries.`
        )
      }
      throw new Error(
        `[getNotificationPageAndWaitForLoad] Failed to get notification page: ${error}`
      )
    }
  }
  throw new Error(
    '[getNotificationPageAndWaitForLoad] Unexpected end of function reached'
  )
}
async function positionWindowWithCDP(page) {
  try {
    const cdpSession = await page.context().newCDPSession(page)
    const targetInfo = await cdpSession.send('Target.getTargetInfo')
    const targetId = targetInfo.targetInfo.targetId
    const windowForTarget = await cdpSession.send(
      'Browser.getWindowForTarget',
      {
        targetId,
      }
    )
    const windowId = windowForTarget.windowId
    await cdpSession.send('Browser.setWindowBounds', {
      windowId,
      bounds: {
        left: 50,
        // Position from left edge of screen
        top: 50,
        // Position from top edge of screen
      },
    })
    await cdpSession.detach()
  } catch (error) {
    console.warn(
      `[positionWindowWithCDP] Failed to position window using CDP: ${error}`
    )
  }
}

// src/playwright/pages/NotificationPage/actions/connectToDapp.ts
async function selectAccounts(
  accountsToSelect,
  accountLocators,
  availableAccountNames
) {
  for (const account of accountsToSelect) {
    const accountNameIndex = availableAccountNames.findIndex((name) =>
      name.startsWith(account)
    )
    if (accountNameIndex < 0)
      throw new Error(`[ConnectToDapp] Account with name ${account} not found`)
    await accountLocators[accountNameIndex]
      ?.locator(NotificationPage_default.ConnectPage.accountCheckbox)
      .check()
  }
}
async function connectMultipleAccounts(notificationPage, accounts) {
  await notificationPage
    .locator(NotificationPage_default.ConnectPage.accountOption)
    .locator(NotificationPage_default.ConnectPage.accountCheckbox)
    .last()
    .setChecked(false)
  const accountLocators = await notificationPage
    .locator(NotificationPage_default.ConnectPage.accountOption)
    .all()
  const accountNames = await allTextContents(accountLocators)
  await selectAccounts(accounts, accountLocators, accountNames)
}
async function confirmConnection(notificationPage) {
  await notificationPage.locator(LockPage_default.passwordInput).fill(password)
  await notificationPage.locator(LockPage_default.submitButton).click()
  await waitForSpinnerToVanish(notificationPage)
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.confirmActionButton)
    .click()
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.confirmActionButton)
    .click()
}
async function connectToDapp(notificationPage, accounts) {
  if (accounts && accounts.length > 0) {
    await connectMultipleAccounts(notificationPage, accounts)
  }
  await confirmConnection(notificationPage)
}

// src/playwright/pages/NotificationPage/actions/signSimpleMessage.ts
var signMessage = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.confirmActionButton)
    .click()
}
var rejectMessage = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.rejectActionButton)
    .click()
}
var signMessageWithRisk = async (notificationPage) => {
  await signMessage(notificationPage)
  await notificationPage
    .locator(NotificationPage_default.SignaturePage.riskModal.signButton)
    .click()
}
var signSimpleMessage = {
  sign: signMessage,
  reject: rejectMessage,
  signWithRisk: signMessageWithRisk,
}

// src/playwright/pages/NotificationPage/actions/signStructuredMessage.ts
var signMessage2 = async (notificationPage) => {
  const scrollDownButton = notificationPage.locator(
    NotificationPage_default.SignaturePage.structuredMessage.scrollDownButton
  )
  const signButton = notificationPage.locator(
    NotificationPage_default.ActionFooter.confirmActionButton
  )
  while (await signButton.isDisabled()) {
    await scrollDownButton.click()
  }
  await signButton.click()
}
var rejectMessage2 = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.rejectActionButton)
    .click()
}
var signStructuredMessage = {
  sign: signMessage2,
  reject: rejectMessage2,
}
var GasSettingValidation = z.union([
  z.literal('low'),
  z.literal('market'),
  z.literal('aggressive'),
  z.literal('site'),
  z
    .object({
      maxBaseFee: z.number(),
      priorityFee: z.number(),
      // TODO: Add gasLimit range validation.
      gasLimit: z.number().optional(),
    })
    .superRefine(({ maxBaseFee, priorityFee }, ctx) => {
      if (priorityFee > maxBaseFee) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Max base fee cannot be lower than priority fee',
          path: ['MetaMask', 'confirmTransaction', 'gasSetting', 'maxBaseFee'],
        })
      }
    }),
])

// src/playwright/pages/NotificationPage/actions/transaction.ts
var sleep3 = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
var MAX_RETRY_ATTEMPTS = 3
var RETRY_DELAY_BASE = 1e3
var confirmTransaction = async (notificationPage, options) => {
  let attempts = 0
  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      await attemptConfirmTransaction(notificationPage, options)
      return
    } catch (error) {
      attempts++
      console.warn(
        `[ConfirmTransaction] Attempt ${attempts}/${MAX_RETRY_ATTEMPTS} failed: ${error}`
      )
      if (attempts >= MAX_RETRY_ATTEMPTS) {
        throw error
      }
      const delay = RETRY_DELAY_BASE * 2 ** (attempts - 1)
      console.log(`[ConfirmTransaction] Retrying in ${delay}ms...`)
      await sleep3(delay)
      if (!notificationPage.isClosed()) {
        try {
          await notificationPage.reload()
          await waitForMetaMaskLoad(notificationPage)
        } catch (reloadError) {
          console.warn(
            `[ConfirmTransaction] Failed to reload page before retry: ${reloadError}`
          )
        }
      }
    }
  }
}
var attemptConfirmTransaction = async (notificationPage, options) => {
  const gasSetting = GasSettingValidation.parse(options)
  const handleNftSetApprovalForAll = async (page) => {
    try {
      const nftApproveButtonLocator = page.locator(
        NotificationPage_default.TransactionPage.nftApproveAllConfirmationPopup
          .approveButton
      )
      const isNfTPopupHidden = await waitFor(
        () => nftApproveButtonLocator.isHidden(),
        1e4,
        false
      )
      if (!isNfTPopupHidden) {
        await nftApproveButtonLocator.click()
      }
    } catch (e) {
      if (page.isClosed()) {
        return
      }
      throw new Error(`Failed to handle NFT setApprovalForAll popup: ${e}`)
    }
  }
  if (gasSetting === 'site') {
    const confirmButton2 = notificationPage.locator(
      NotificationPage_default.ActionFooter.confirmActionButton
    )
    await confirmButton2.waitFor({ state: 'visible', timeout: 1e4 })
    await confirmButton2.click()
    await handleNftSetApprovalForAll(notificationPage)
    return
  }
  const editGasFeeButton = notificationPage.locator(
    NotificationPage_default.TransactionPage.editGasFeeMenu.editGasFeeButton
  )
  await editGasFeeButton.waitFor({ state: 'visible', timeout: 1e4 })
  await editGasFeeButton.click()
  const estimationNotAvailableErrorMessage = (gasSetting2) =>
    `[ConfirmTransaction] Estimated fee is not available for the "${gasSetting2}" gas setting. By default, MetaMask would use the "site" gas setting in this case, however, this is not YOUR intention.`
  const handleLowMediumOrAggressiveGasSetting = async (
    gasSetting2,
    selectors
  ) => {
    if (
      (await notificationPage.locator(selectors.maxFee).textContent()) === '--'
    ) {
      throw new Error(estimationNotAvailableErrorMessage(gasSetting2))
    }
    await notificationPage.locator(selectors.button).click()
  }
  if (gasSetting === 'low') {
    await handleLowMediumOrAggressiveGasSetting(
      gasSetting,
      NotificationPage_default.TransactionPage.editGasFeeMenu.lowGasFee
    )
  } else if (gasSetting === 'market') {
    await handleLowMediumOrAggressiveGasSetting(
      gasSetting,
      NotificationPage_default.TransactionPage.editGasFeeMenu.marketGasFee
    )
  } else if (gasSetting === 'aggressive') {
    await handleLowMediumOrAggressiveGasSetting(
      gasSetting,
      NotificationPage_default.TransactionPage.editGasFeeMenu.aggressiveGasFee
    )
  } else {
    await notificationPage
      .locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .advancedGasFeeButton
      )
      .click()
    await notificationPage
      .locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .advancedGasFeeMenu.maxBaseFeeInput
      )
      .fill('')
    await notificationPage
      .locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .advancedGasFeeMenu.maxBaseFeeInput
      )
      .fill(gasSetting.maxBaseFee.toString())
    await notificationPage
      .locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .advancedGasFeeMenu.priorityFeeInput
      )
      .fill('')
    await notificationPage
      .locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .advancedGasFeeMenu.priorityFeeInput
      )
      .fill(gasSetting.priorityFee.toString())
    if (gasSetting.gasLimit) {
      await notificationPage
        .locator(
          NotificationPage_default.TransactionPage.editGasFeeMenu
            .advancedGasFeeMenu.gasLimitEditButton
        )
        .click()
      await notificationPage
        .locator(
          NotificationPage_default.TransactionPage.editGasFeeMenu
            .advancedGasFeeMenu.gasLimitInput
        )
        .fill('')
      await notificationPage
        .locator(
          NotificationPage_default.TransactionPage.editGasFeeMenu
            .advancedGasFeeMenu.gasLimitInput
        )
        .fill(gasSetting.gasLimit.toString())
      const gasLimitErrorLocator = notificationPage.locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .advancedGasFeeMenu.gasLimitError
      )
      const isGasLimitErrorHidden = await waitFor(
        () => gasLimitErrorLocator.isHidden(),
        1e4,
        false
      )
      if (!isGasLimitErrorHidden) {
        const errorText = await gasLimitErrorLocator.textContent({
          timeout: 1e4,
          // TODO: Extract & make configurable
        })
        throw new Error(`[ConfirmTransaction] Invalid gas limit: ${errorText}`)
      }
    }
    await notificationPage
      .locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .advancedGasFeeMenu.saveButton
      )
      .click()
  }
  const waitForAction = async () => {
    const isTooltipVisible = await notificationPage
      .locator(
        NotificationPage_default.TransactionPage.editGasFeeMenu
          .editGasFeeButtonToolTip
      )
      .isVisible()
    return !isTooltipVisible
  }
  await waitFor(waitForAction, 1e4, true)
  const confirmButton = notificationPage.locator(
    NotificationPage_default.ActionFooter.confirmActionButton
  )
  await confirmButton.waitFor({ state: 'visible', timeout: 1e4 })
  await confirmButton.click()
  await handleNftSetApprovalForAll(notificationPage)
}
var confirmTransactionAndWaitForMining = async (
  walletPage,
  notificationPage,
  options
) => {
  await walletPage
    .locator(HomePage_default.activityTab.activityTabButton)
    .click()
  const waitForUnapprovedTxs = async () => {
    const unapprovedTxs = await walletPage
      .locator(HomePage_default.activityTab.pendingUnapprovedTransactions)
      .count()
    return unapprovedTxs !== 0
  }
  const newTxsFound = await waitFor(waitForUnapprovedTxs, 3e4, false)
  if (!newTxsFound) {
    throw new Error('No new pending transactions found in 30s')
  }
  await confirmTransaction(notificationPage, options)
  const waitForMining = async () => {
    const unapprovedTxs = await walletPage
      .locator(HomePage_default.activityTab.pendingUnapprovedTransactions)
      .count()
    const pendingTxs = await walletPage
      .locator(HomePage_default.activityTab.pendingApprovedTransactions)
      .count()
    const queuedTxs = await walletPage
      .locator(HomePage_default.activityTab.pendingQueuedTransactions)
      .count()
    return unapprovedTxs === 0 && pendingTxs === 0 && queuedTxs === 0
  }
  const allTxsMined = await waitFor(waitForMining, 12e4, false)
  if (!allTxsMined) {
    throw new Error(
      'All pending and queued transactions were not mined in 120s'
    )
  }
}
var rejectTransaction = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.rejectActionButton)
    .click()
}
var transaction = {
  confirm: confirmTransaction,
  reject: rejectTransaction,
  confirmAndWaitForMining: confirmTransactionAndWaitForMining,
}

// src/playwright/pages/NotificationPage/actions/approvePermission.ts
var editTokenPermission = async (notificationPage, customSpendLimit) => {
  if (customSpendLimit === 'max') {
    await notificationPage
      .locator(NotificationPage_default.PermissionPage.approve.maxButton)
      .click()
    return
  }
  await notificationPage
    .locator(
      NotificationPage_default.PermissionPage.approve.customSpendingCapInput
    )
    .fill(customSpendLimit.toString())
}
var approveTokenPermission = async (notificationPage, gasSetting) => {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.confirmActionButton)
    .click()
  await transaction.confirm(notificationPage, gasSetting)
}
var rejectTokenPermission = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.rejectActionButton)
    .click()
}
var approvePermission = {
  editTokenPermission,
  approve: approveTokenPermission,
  reject: rejectTokenPermission,
}

// src/playwright/pages/NotificationPage/actions/network.ts
var approveNewNetwork = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.NetworkPage.addNetwork.approveButton)
    .click()
}
var rejectNewNetwork = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.NetworkPage.addNetwork.cancelButton)
    .click()
}
var approveSwitchNetwork = async (notificationPage) => {
  await notificationPage
    .locator(
      NotificationPage_default.NetworkPage.switchNetwork.switchNetworkButton
    )
    .click()
}
var rejectSwitchNetwork = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.NetworkPage.switchNetwork.cancelButton)
    .click()
}
var network = {
  approveNewNetwork,
  rejectNewNetwork,
  approveSwitchNetwork,
  rejectSwitchNetwork,
}

// src/playwright/pages/NotificationPage/actions/token.ts
async function addNew(notificationPage) {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.confirmActionButton)
    .click()
}
var token = {
  addNew,
}

// src/playwright/pages/NotificationPage/actions/encryption.ts
async function providePublicEncryptionKey(notificationPage) {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.confirmActionButton)
    .click()
}
async function decryptMessage(notificationPage) {
  await notificationPage
    .locator(NotificationPage_default.ActionFooter.confirmActionButton)
    .click()
}

// src/playwright/pages/NotificationPage/actions/ethereumRpc.ts
var approveNewEthereumRPC = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.EthereumRpcPage.approveNewRpc)
    .click()
}
var rejectNewEthereumRPC = async (notificationPage) => {
  await notificationPage
    .locator(NotificationPage_default.EthereumRpcPage.rejectNewRpc)
    .click()
}
var ethereumRpc = {
  approveNewEthereumRPC,
  rejectNewEthereumRPC,
}

// src/playwright/pages/NotificationPage/page.ts
var NotificationPage = class {
  static selectors = NotificationPage_default
  selectors = NotificationPage_default
  page
  constructor(page) {
    this.page = page
  }
  async connectToDapp(extensionId, accounts) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await connectToDapp(notificationPage, accounts)
  }
  // TODO: Revisit this logic in the future to see if we can increase the performance by utilizing `Promise.race`.
  async beforeMessageSignature(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    const scrollButton = notificationPage.locator(
      NotificationPage_default.SignaturePage.structuredMessage.scrollDownButton
    )
    const isScrollButtonPresent = (await scrollButton.count()) > 0
    let isScrollButtonVisible = false
    if (isScrollButtonPresent) {
      await scrollButton.waitFor({ state: 'visible' })
      isScrollButtonVisible = true
    }
    return {
      notificationPage,
      isScrollButtonVisible,
    }
  }
  async signMessage(extensionId) {
    const { notificationPage, isScrollButtonVisible } =
      await this.beforeMessageSignature(extensionId)
    if (isScrollButtonVisible) {
      await signStructuredMessage.sign(notificationPage)
    } else {
      await signSimpleMessage.sign(notificationPage)
    }
  }
  async signMessageWithRisk(extensionId) {
    const { notificationPage } = await this.beforeMessageSignature(extensionId)
    await signSimpleMessage.signWithRisk(notificationPage)
  }
  async rejectMessage(extensionId) {
    const { notificationPage, isScrollButtonVisible } =
      await this.beforeMessageSignature(extensionId)
    if (isScrollButtonVisible) {
      await signStructuredMessage.reject(notificationPage)
    } else {
      await signSimpleMessage.reject(notificationPage)
    }
  }
  async approveNewNetwork(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await network.approveNewNetwork(notificationPage)
  }
  async rejectNewNetwork(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await network.rejectNewNetwork(notificationPage)
  }
  async approveSwitchNetwork(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await network.approveSwitchNetwork(notificationPage)
  }
  async rejectSwitchNetwork(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await network.rejectSwitchNetwork(notificationPage)
  }
  async approveNewEthereumRPC(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await ethereumRpc.approveNewEthereumRPC(notificationPage)
  }
  async rejectNewEthereumRPC(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await ethereumRpc.rejectNewEthereumRPC(notificationPage)
  }
  async confirmTransaction(extensionId, options) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await transaction.confirm(notificationPage, options?.gasSetting ?? 'site')
  }
  async rejectTransaction(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await transaction.reject(notificationPage)
  }
  async confirmTransactionAndWaitForMining(extensionId, options) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await transaction.confirmAndWaitForMining(
      this.page,
      notificationPage,
      options?.gasSetting ?? 'site'
    )
  }
  async approveTokenPermission(extensionId, options) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    if (options?.spendLimit !== void 0) {
      await approvePermission.editTokenPermission(
        notificationPage,
        options.spendLimit
      )
    }
    await approvePermission.approve(
      notificationPage,
      options?.gasSetting ?? 'site'
    )
  }
  async rejectTokenPermission(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await approvePermission.reject(notificationPage)
  }
  async addNewToken(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await token.addNew(notificationPage)
  }
  async providePublicEncryptionKey(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await providePublicEncryptionKey(notificationPage)
  }
  async decryptMessage(extensionId) {
    const notificationPage = await getNotificationPageAndWaitForLoad(
      this.page.context(),
      extensionId
    )
    await decryptMessage(notificationPage)
  }
}

// src/playwright/pages/SettingsPage/actions/enableEthSign.ts
async function enableEthSign(page) {
  await page.locator(SettingsPage_default.settings.advancedSettings).click()
  await page.locator(SettingsPage_default.settings.ethSignToggle).click()
  await page
    .locator(SettingsPage_default.confirmationModal.confirmationCheckbox)
    .click()
  await page
    .locator(SettingsPage_default.confirmationModal.continueButton)
    .click()
  await page
    .locator(SettingsPage_default.confirmationModal.manualConfirmationInput)
    .focus()
  await page
    .locator(SettingsPage_default.confirmationModal.manualConfirmationInput)
    .fill('I only sign what I understand')
  await page
    .locator(SettingsPage_default.confirmationModal.enableButton)
    .click()
  await page.locator(SettingsPage_default.settings.ethSignWarning).isVisible()
}

// src/playwright/pages/SettingsPage/actions/disableEthSign.ts
async function disableEthSign(page) {
  await page.locator(SettingsPage_default.settings.advancedSettings).click()
  await page.locator(SettingsPage_default.settings.ethSignToggle).click()
}

// src/playwright/pages/SettingsPage/page.ts
var SettingsPage = class {
  static selectors = SettingsPage_default
  page
  constructor(page) {
    this.page = page
  }
  async enableEthSign() {
    await enableEthSign(this.page)
  }
  async disableEthSign() {
    await disableEthSign(this.page)
  }
}

// src/playwright/MetaMask.ts
var NO_EXTENSION_ID_ERROR = new Error('MetaMask extensionId is not set')
var MetaMask = class extends MetaMaskAbstract {
  /**
   * Creates an instance of MetaMask.
   *
   * @param context - The Playwright BrowserContext in which the MetaMask extension is running.
   * @param page - The Playwright Page object representing the MetaMask extension's main page.
   * @param password - The password for the MetaMask wallet.
   * @param extensionId - The ID of the MetaMask extension. Optional if no interaction with dapps is required.
   */
  constructor(context2, page, password, extensionId) {
    super(password, extensionId)
    this.context = context2
    this.page = page
    this.password = password
    this.extensionId = extensionId
    this.crashPage = new CrashPage()
    this.onboardingPage = new OnboardingPage(page)
    this.lockPage = new LockPage(page)
    this.homePage = new HomePage(page)
    this.notificationPage = new NotificationPage(page)
    this.settingsPage = new SettingsPage(page)
  }
  /**
   * This property can be used to access selectors for the crash page.
   *
   * @public
   * @readonly
   */
  crashPage
  /**
   * This property can be used to access selectors for the onboarding page.
   *
   * @public
   * @readonly
   */
  onboardingPage
  /**
   * This property can be used to access selectors for the lock page.
   *
   * @public
   * @readonly
   */
  lockPage
  /**
   * This property can be used to access selectors for the home page.
   *
   * @public
   * @readonly
   */
  homePage
  /**
   * This property can be used to access selectors for the notification page.
   *
   * @public
   * @readonly
   */
  notificationPage
  /**
   * This property can be used to access selectors for the settings page.
   *
   * @public
   * @readonly
   */
  settingsPage
  /**
   * Imports a wallet using the given seed phrase.
   *
   * @param seedPhrase - The seed phrase to import.
   */
  async importWallet(seedPhrase) {
    await this.onboardingPage.importWallet(seedPhrase, this.password)
  }
  /**
   * Adds a new account with the given name.
   *
   * @param accountName - The name for the new account.
   */
  async addNewAccount(accountName) {
    await this.homePage.addNewAccount(accountName)
  }
  /**
   * Renames the currently selected account.
   *
   * @param currentAccountName - The current account name.
   * @param newAccountName - The new name for the account.
   */
  async renameAccount(currentAccountName, newAccountName) {
    await this.homePage.renameAccount(currentAccountName, newAccountName)
  }
  /**
   * Imports a wallet using the given private key.
   *
   * @param privateKey - The private key to import.
   */
  async importWalletFromPrivateKey(privateKey) {
    await this.homePage.importWalletFromPrivateKey(privateKey)
  }
  /**
   * Switches to the account with the given name.
   *
   * @param accountName - The name of the account to switch to.
   */
  async switchAccount(accountName) {
    await this.homePage.switchAccount(accountName)
  }
  /**
   * Adds a new network to MetaMask.
   *
   * @param network - The network configuration to add.
   */
  async addNetwork(network2) {
    await this.homePage.addNetwork(network2)
  }
  /**
   * Gets the address of the currently selected account.
   *
   * @returns The account address.
   */
  async getAccountAddress() {
    return await this.homePage.getAccountAddress()
  }
  /**
   * Switches to the specified network.
   *
   * @param networkName - The name of the network to switch to.
   * @param isTestnet - Whether the network is a testnet. Default is false.
   */
  async switchNetwork(networkName, isTestnet = false) {
    await this.homePage.switchNetwork(networkName, isTestnet)
  }
  /**
   * Connects MetaMask to a dapp.
   *
   * @param accounts - Optional array of account addresses to connect.
   * @throws {Error} If extensionId is not set.
   */
  async connectToDapp(accounts) {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.connectToDapp(this.extensionId, accounts)
  }
  /**
   * Locks the MetaMask wallet.
   */
  async lock() {
    await this.homePage.lock()
  }
  /**
   * Unlocks the MetaMask wallet.
   */
  async unlock() {
    await this.lockPage.unlock(this.password)
  }
  /**
   * Confirms a signature request.
   *
   * @throws {Error} If extensionId is not set.
   */
  async confirmSignature() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.signMessage(this.extensionId)
  }
  /**
   * Confirms a signature request with risk.
   *
   * @throws {Error} If extensionId is not set.
   */
  async confirmSignatureWithRisk() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.signMessageWithRisk(this.extensionId)
  }
  /**
   * Rejects a signature request.
   *
   * @throws {Error} If extensionId is not set.
   */
  async rejectSignature() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.rejectMessage(this.extensionId)
  }
  /**
   * Approves adding a new network.
   *
   * @throws {Error} If extensionId is not set.
   */
  async approveNewNetwork() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.approveNewNetwork(this.extensionId)
  }
  /**
   * Rejects adding a new network.
   *
   * @throws {Error} If extensionId is not set.
   */
  async rejectNewNetwork() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.rejectNewNetwork(this.extensionId)
  }
  /**
   * Approves switching to a new network.
   *
   * @throws {Error} If extensionId is not set.
   */
  async approveSwitchNetwork() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.approveSwitchNetwork(this.extensionId)
  }
  /**
   * Rejects switching to a new network.
   *
   * @throws {Error} If extensionId is not set.
   */
  async rejectSwitchNetwork() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.rejectSwitchNetwork(this.extensionId)
  }
  /**
   * Approves adding a new RPC provider for Ethereum Mainnet.
   *
   * @throws {Error} If extensionId is not set.
   */
  async approveNewEthereumRPC() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.approveNewEthereumRPC(this.extensionId)
  }
  /**
   * Rejects adding a new RPC provider for Ethereum Mainnet.
   *
   * @throws {Error} If extensionId is not set.
   */
  async rejectNewEthereumRPC() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.rejectNewEthereumRPC(this.extensionId)
  }
  /**
   * Confirms a transaction.
   *
   * @param options - Optional gas settings for the transaction.
   * @throws {Error} If extensionId is not set.
   */
  async confirmTransaction(options) {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.confirmTransaction(this.extensionId, options)
  }
  /**
   * Rejects a transaction.
   *
   * @throws {Error} If extensionId is not set.
   */
  async rejectTransaction() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.rejectTransaction(this.extensionId)
  }
  /**
   * Approves a token permission request.
   *
   * @param options - Optional settings for the approval.
   * @throws {Error} If extensionId is not set.
   */
  async approveTokenPermission(options) {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.approveTokenPermission(
      this.extensionId,
      options
    )
  }
  /**
   * Rejects a token permission request.
   *
   * @throws {Error} If extensionId is not set.
   */
  async rejectTokenPermission() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.rejectTokenPermission(this.extensionId)
  }
  /**
   * Navigates back to the home page.
   */
  async goBackToHomePage() {
    await this.homePage.goBackToHomePage()
  }
  /**
   * Opens the settings page.
   */
  async openSettings() {
    await this.homePage.openSettings()
  }
  /**
   * Opens a specific sidebar menu in the settings.
   *
   * @param menu - The menu to open.
   */
  async openSidebarMenu(menu) {
    await this.homePage.openSidebarMenu(menu)
  }
  /**
   * Toggles the display of test networks.
   */
  async toggleShowTestNetworks() {
    await this.homePage.toggleShowTestNetworks()
  }
  /**
   * Toggles the dismissal of the secret recovery phrase reminder.
   */
  async toggleDismissSecretRecoveryPhraseReminder() {
    await this.homePage.toggleDismissSecretRecoveryPhraseReminder()
  }
  /**
   * Resets the account.
   */
  async resetAccount() {
    await this.homePage.resetAccount()
  }
  /**
   * Enables eth_sign (unsafe).
   */
  async unsafe_enableEthSign() {
    await this.homePage.openSettings()
    await this.settingsPage.enableEthSign()
  }
  /**
   * Disables eth_sign.
   */
  async disableEthSign() {
    await this.homePage.openSettings()
    await this.settingsPage.disableEthSign()
  }
  /**
   * Adds a new token.
   *
   * @throws {Error} If extensionId is not set.
   */
  async addNewToken() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.addNewToken(this.extensionId)
  }
  /**
   * Provides a public encryption key.
   *
   * @throws {Error} If extensionId is not set.
   */
  async providePublicEncryptionKey() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.providePublicEncryptionKey(this.extensionId)
  }
  /**
   * Decrypts a message.
   *
   * @throws {Error} If extensionId is not set.
   */
  async decrypt() {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.decryptMessage(this.extensionId)
  }
  /**
   * Confirms a transaction and waits for it to be mined.
   *
   * @param options - Optional gas settings for the transaction.
   * @throws {Error} If extensionId is not set.
   */
  async confirmTransactionAndWaitForMining(options) {
    if (!this.extensionId) {
      throw NO_EXTENSION_ID_ERROR
    }
    await this.notificationPage.confirmTransactionAndWaitForMining(
      this.extensionId,
      options
    )
  }
  /**
   * Opens the details of a specific transaction.
   *
   * @param txIndex - The index of the transaction to open.
   */
  async openTransactionDetails(txIndex) {
    await this.homePage.openTransactionDetails(txIndex)
  }
  /**
   * Closes the transaction details view.
   */
  async closeTransactionDetails() {
    await this.homePage.closeTransactionDetails()
  }
}
var DEFAULT_METAMASK_VERSION = '13.4.0'
var EXTENSION_DOWNLOAD_URL = `https://github.com/MetaMask/metamask-extension/releases/download/v${DEFAULT_METAMASK_VERSION}/metamask-chrome-${DEFAULT_METAMASK_VERSION}.zip`
async function prepareExtension(forceCache = true) {
  let outputDir = ''
  if (forceCache) {
    outputDir = ensureCacheDirExists()
  } else {
    outputDir = path.resolve('./', 'downloads')
    if (!(await fs.exists(outputDir))) {
      fs.mkdirSync(outputDir)
    }
  }
  const downloadResult = await downloadFile({
    url: EXTENSION_DOWNLOAD_URL,
    outputDir,
    fileName: `metamask-chrome-${DEFAULT_METAMASK_VERSION}.zip`,
  })
  const unzipResult = await unzipArchive({
    archivePath: downloadResult.filePath,
  })
  return unzipResult.outputPath
}
var Extension = z.object({
  id: z.string(),
  name: z.string(),
})
var Extensions = z.array(Extension)
async function getExtensionId(context2, extensionName) {
  const page = await context2.newPage()
  await page.goto('chrome://extensions')
  const unparsedExtensions = await page.evaluate('chrome.management.getAll()')
  const allExtensions = Extensions.parse(unparsedExtensions)
  const targetExtension = allExtensions.find(
    (extension) => extension.name.toLowerCase() === extensionName.toLowerCase()
  )
  if (!targetExtension) {
    throw new Error(
      [
        `[GetExtensionId] Extension with name ${extensionName} not found.`,
        `Available extensions: ${allExtensions
          .map((extension) => extension.name)
          .join(', ')}`,
      ].join('\n')
    )
  }
  await page.close()
  return targetExtension.id
}

// src/cypress/getPlaywrightMetamask.ts
var metamask
function getPlaywrightMetamask(
  context2,
  metamaskExtensionPage2,
  metamaskExtensionId2
) {
  if (!metamask) {
    metamask = new MetaMask(
      context2,
      metamaskExtensionPage2,
      'password',
      metamaskExtensionId2
    )
  }
  return metamask
}

// src/cypress/MetaMask.ts
var pool
var MetaMask2 = class {
  /** The MetaMask instance for Playwright */
  metamaskPlaywright
  /** The MetaMask extension page */
  metamaskExtensionPage
  /**
   * Creates an instance of MetaMask.
   * @param context - The browser context
   * @param metamaskExtensionPage - The MetaMask extension page
   * @param metamaskExtensionId - The MetaMask extension ID
   */
  constructor(context2, metamaskExtensionPage2, metamaskExtensionId2) {
    this.metamaskPlaywright = getPlaywrightMetamask(
      context2,
      metamaskExtensionPage2,
      metamaskExtensionId2
    )
    this.metamaskExtensionPage = metamaskExtensionPage2
  }
  /**
   * Gets the current account name.
   * @returns The current account name
   */
  async getAccount() {
    return await this.metamaskExtensionPage
      .locator(
        this.metamaskPlaywright.homePage.selectors.accountMenu.accountButton
      )
      .innerText()
  }
  /**
   * Gets the current account address.
   * @returns The current account address
   */
  async getAccountAddress() {
    return await this.metamaskPlaywright.getAccountAddress()
  }
  /**
   * Gets the current network name.
   * @returns The current network name
   */
  async getNetwork() {
    return await this.metamaskExtensionPage
      .locator(this.metamaskPlaywright.homePage.selectors.currentNetwork)
      .innerText()
  }
  /**
   * Connects MetaMask to a dApp.
   * @param accounts - Optional array of account addresses to connect
   * @returns True if the connection was successful
   */
  async connectToDapp(accounts) {
    await this.metamaskPlaywright.connectToDapp(accounts)
    return true
  }
  /**
   * Imports a wallet using a seed phrase.
   * @param seedPhrase - The seed phrase to import
   * @returns True if the import was successful
   */
  async importWallet(seedPhrase) {
    await this.metamaskPlaywright.importWallet(seedPhrase)
    return true
  }
  /**
   * Imports a wallet using a private key.
   * @param privateKey - The private key to import
   * @returns True if the import was successful
   */
  async importWalletFromPrivateKey(privateKey) {
    await this.metamaskPlaywright.importWalletFromPrivateKey(privateKey)
    return true
  }
  /**
   * Adds a new account with the given name.
   * @param accountName - The name for the new account
   * @returns True if the account was added successfully
   */
  async addNewAccount(accountName) {
    await this.metamaskPlaywright.addNewAccount(accountName)
    await expect(
      this.metamaskExtensionPage.locator(
        this.metamaskPlaywright.homePage.selectors.accountMenu.accountButton
      )
    ).toHaveText(accountName)
    return true
  }
  /**
   * Switches to the account with the given name.
   * @param accountName - The name of the account to switch to
   * @returns True if the switch was successful
   */
  async switchAccount(accountName) {
    await this.metamaskPlaywright.switchAccount(accountName)
    await expect(
      this.metamaskExtensionPage.locator(
        this.metamaskPlaywright.homePage.selectors.accountMenu.accountButton
      )
    ).toHaveText(accountName)
    return true
  }
  /**
   * Renames an account.
   * @param options - Object containing the current and new account names
   * @param options.currentAccountName - The current name of the account
   * @param options.newAccountName - The new name for the account
   * @returns True if the rename was successful
   */
  async renameAccount({ currentAccountName, newAccountName }) {
    await this.metamaskPlaywright.renameAccount(
      currentAccountName,
      newAccountName
    )
    await this.metamaskExtensionPage
      .locator(HomePage_default.threeDotsMenu.accountDetailsCloseButton)
      .click()
    await expect(
      this.metamaskExtensionPage.locator(
        this.metamaskPlaywright.homePage.selectors.accountMenu.accountButton
      )
    ).toHaveText(newAccountName)
    return true
  }
  /**
   * Resets the current account.
   * @returns True if the reset was successful
   */
  async resetAccount() {
    await this.metamaskPlaywright.resetAccount()
    return true
  }
  /**
   * Switches to the specified network.
   * @param options - Object containing the network name and testnet flag
   * @param options.networkName - The name of the network to switch to
   * @param options.isTestnet - Whether the network is a testnet (default: false)
   * @returns True if the switch was successful, false otherwise
   */
  async switchNetwork({ networkName, isTestnet = false }) {
    return await this.metamaskPlaywright
      .switchNetwork(networkName, isTestnet)
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Creates an Anvil node for testing.
   * @param options - Optional Anvil node creation options
   * @returns Object containing the Anvil instance, RPC URL, and chain ID
   */
  async createAnvilNode(options) {
    pool = createPool()
    const nodeId = Array.from(pool.instances()).length
    const anvil = await pool.start(nodeId, options)
    const rpcUrl = `http://${anvil.host}:${anvil.port}`
    const DEFAULT_ANVIL_CHAIN_ID = 31337
    const chainId = options?.chainId ?? DEFAULT_ANVIL_CHAIN_ID
    return { anvil, rpcUrl, chainId }
  }
  /**
   * Empties the Anvil node pool.
   * @returns True if the operation was successful
   */
  async emptyAnvilNode() {
    await pool.empty()
    return true
  }
  /**
   * Connects to an Anvil node.
   * @param options - Object containing the RPC URL and chain ID
   * @param options.rpcUrl - The RPC URL of the Anvil node
   * @param options.chainId - The chain ID of the Anvil node
   * @returns True if the connection was successful, false otherwise
   */
  async connectToAnvil({ rpcUrl, chainId }) {
    try {
      await this.metamaskPlaywright.addNetwork({
        name: 'Anvil',
        rpcUrl,
        chainId,
        symbol: 'ETH',
        blockExplorerUrl: 'https://etherscan.io/',
      })
      await this.metamaskPlaywright.switchNetwork('Anvil')
      return true
    } catch (e) {
      console.error('Error connecting to Anvil network', e)
      return false
    }
  }
  /**
   * Adds a new network to MetaMask.
   * @param network - The network configuration to add
   * @returns True if the network was added successfully
   */
  async addNetwork(network2) {
    await this.metamaskPlaywright.addNetwork(network2)
    await waitFor(
      () =>
        this.metamaskExtensionPage
          .locator(HomePage_default.networkAddedPopover.switchToNetworkButton)
          .isVisible(),
      3e3,
      false
    )
    await this.metamaskExtensionPage
      .locator(HomePage_default.networkAddedPopover.switchToNetworkButton)
      .click()
    return true
  }
  /**
   * Deploys a token.
   * @returns True if the token was deployed successfully
   */
  async deployToken() {
    await waitFor(
      () =>
        this.metamaskExtensionPage
          .locator(
            transactionPage_default.nftApproveAllConfirmationPopup.approveButton
          )
          .isVisible(),
      3e3,
      false
    )
    await this.metamaskPlaywright.confirmTransaction()
    return true
  }
  /**
   * Adds a new token to MetaMask.
   * @returns True if the token was added successfully
   */
  async addNewToken() {
    await this.metamaskPlaywright.addNewToken()
    await expect(
      this.metamaskExtensionPage
        .locator(HomePage_default.portfolio.singleToken)
        .nth(1)
    ).toContainText('TST')
    return true
  }
  /**
   * Approves token permission.
   * @param options - Optional settings for token approval
   * @param options.spendLimit - The spend limit for the token (number or 'max')
   * @param options.gasSetting - Gas settings for the transaction
   * @returns True if the permission was approved, false otherwise
   */
  async approveTokenPermission(options) {
    return await this.metamaskPlaywright
      .approveTokenPermission(options)
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Rejects token permission.
   * @returns True if the permission was rejected successfully
   */
  async rejectTokenPermission() {
    await this.metamaskPlaywright.rejectTokenPermission()
    return true
  }
  /**
   * Approves adding a new network.
   * @returns True if the new network was approved successfully
   */
  async approveNewNetwork() {
    await this.metamaskPlaywright.approveNewNetwork()
    return true
  }
  /**
   * Approves switching to a new network.
   * @returns True if the network switch was approved successfully
   */
  async approveSwitchNetwork() {
    await this.metamaskPlaywright.approveSwitchNetwork()
    return true
  }
  /**
   * Rejects adding a new network.
   * @returns True if the new network was rejected successfully
   */
  async rejectNewNetwork() {
    await this.metamaskPlaywright.rejectNewNetwork()
    return true
  }
  /**
   * Rejects switching to a new network.
   * @returns True if the network switch was rejected successfully
   */
  async rejectSwitchNetwork() {
    await this.metamaskPlaywright.rejectSwitchNetwork()
    return true
  }
  /**
   * Approves adding a new RPC provider for Ethereum Mainnet.
   *
   * @returns True if the RPC provider was approved successfully
   */
  async approveNewEthereumRPC() {
    await this.metamaskPlaywright.approveNewEthereumRPC()
    return true
  }
  /**
   * Rejects adding a new RPC provider for Ethereum Mainnet.
   *
   * @returns True if the RPC provider was rejected successfully
   */
  async rejectNewEthereumRPC() {
    await this.metamaskPlaywright.rejectNewEthereumRPC()
    return true
  }
  /**
   * Locks the MetaMask wallet.
   * @returns True if the wallet was locked successfully
   */
  async lock() {
    await this.metamaskPlaywright.lock()
    await expect(
      this.metamaskExtensionPage.locator(
        this.metamaskPlaywright.lockPage.selectors.submitButton
      )
    ).toBeVisible()
    return true
  }
  /**
   * Unlocks the MetaMask wallet.
   * @returns True if the wallet was unlocked successfully
   */
  async unlock() {
    await this.metamaskPlaywright.unlock()
    await expect(
      this.metamaskExtensionPage.locator(
        this.metamaskPlaywright.homePage.selectors.logo
      )
    ).toBeVisible()
    return true
  }
  /**
   * Provides a public encryption key.
   * @returns True if the key was provided successfully, false otherwise
   */
  async providePublicEncryptionKey() {
    return await this.metamaskPlaywright
      .providePublicEncryptionKey()
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Decrypts a message.
   * @returns True if the message was decrypted successfully, false otherwise
   */
  async decrypt() {
    return await this.metamaskPlaywright
      .decrypt()
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Confirms a signature request.
   * @returns True if the signature was confirmed successfully, false otherwise
   */
  async confirmSignature() {
    return await this.metamaskPlaywright
      .confirmSignature()
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Rejects a signature request.
   * @returns True if the signature was rejected successfully
   */
  async rejectSignature() {
    await this.metamaskPlaywright.rejectSignature()
    return true
  }
  /**
   * Confirms a transaction.
   * @param options - Optional gas settings for the transaction
   * @returns True if the transaction was confirmed successfully
   */
  async confirmTransaction(options) {
    await waitFor(
      () =>
        this.metamaskExtensionPage
          .locator(
            transactionPage_default.nftApproveAllConfirmationPopup.approveButton
          )
          .isVisible(),
      5e3,
      false
    )
    await this.metamaskPlaywright.confirmTransaction(options)
    return true
  }
  /**
   * Rejects a transaction.
   * @returns True if the transaction was rejected successfully
   */
  async rejectTransaction() {
    await this.metamaskPlaywright.rejectTransaction()
    return true
  }
  /**
   * Confirms a transaction and waits for it to be mined.
   * @returns True if the transaction was confirmed and mined successfully, false otherwise
   */
  async confirmTransactionAndWaitForMining() {
    await waitFor(
      () =>
        this.metamaskExtensionPage
          .locator(
            transactionPage_default.nftApproveAllConfirmationPopup.approveButton
          )
          .isVisible(),
      5e3,
      false
    )
    return this.metamaskPlaywright
      .confirmTransactionAndWaitForMining()
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Opens the details of a specific transaction.
   * @param txIndex - The index of the transaction to open
   * @returns True if the transaction details were opened successfully, false otherwise
   */
  async openTransactionDetails(txIndex) {
    return this.metamaskPlaywright
      .openTransactionDetails(txIndex)
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Closes the transaction details view.
   * @returns True if the transaction details were closed successfully, false otherwise
   */
  async closeTransactionDetails() {
    return this.metamaskPlaywright
      .closeTransactionDetails()
      .then(() => {
        return true
      })
      .catch(() => {
        return false
      })
  }
  /**
   * Toggles the display of test networks.
   * @returns True if the toggle was successful
   */
  async toggleShowTestNetworks() {
    await this.metamaskPlaywright.toggleShowTestNetworks()
    return true
  }
  /**
   * Toggles the dismissal of the secret recovery phrase reminder.
   * @returns True if the toggle was successful
   */
  async toggleDismissSecretRecoveryPhraseReminder() {
    await this.metamaskPlaywright.toggleDismissSecretRecoveryPhraseReminder()
    return true
  }
  /**
   * Navigates back to the home page.
   * @returns True if the navigation was successful
   */
  async goBackToHomePage() {
    await this.metamaskPlaywright.openSettings()
    await expect(
      this.metamaskExtensionPage.locator(
        HomePage_default.copyAccountAddressButton
      )
    ).not.toBeVisible()
    await this.metamaskPlaywright.goBackToHomePage()
    await expect(
      this.metamaskExtensionPage.locator(
        HomePage_default.copyAccountAddressButton
      )
    ).toBeVisible()
    return true
  }
  /**
   * Opens the settings page.
   * @returns True if the settings page was opened successfully
   */
  async openSettings() {
    await this.metamaskPlaywright.openSettings()
    return true
  }
  /**
   * Opens a specific sidebar menu in the settings.
   * @param menu - The menu to open
   * @returns True if the menu was opened successfully
   */
  async openSidebarMenu(menu) {
    await this.metamaskPlaywright.openSidebarMenu(menu)
    await expect(
      this.metamaskExtensionPage.locator(
        HomePage_default.settings.sidebarMenu(menu)
      )
    ).toBeVisible()
    return true
  }
}
var SEED_PHRASE = 'test test test test test test test test test test test junk'
async function importMetaMaskWallet(port, importDefaultWallet = true) {
  const debuggerDetails = await fetch(`http://127.0.0.1:${port}/json/version`)
  const debuggerDetailsConfig = await debuggerDetails.json()
  const browser = await chromium.connectOverCDP(
    debuggerDetailsConfig.webSocketDebuggerUrl
  )
  const context2 = browser.contexts()[0]
  await context2.waitForEvent('response')
  let metamaskExtensionId2
  let extensionPage
  let cypressPage
  const extensionPageIndex = context2
    .pages()
    .findIndex((page) => page.url().includes('chrome-extension://'))
  if (extensionPageIndex !== -1) {
    extensionPage = context2.pages()[extensionPageIndex]
    metamaskExtensionId2 = await getExtensionId(context2, 'MetaMask')
    const metamask3 = getPlaywrightMetamask(
      context2,
      extensionPage,
      metamaskExtensionId2
    )
    if (importDefaultWallet) await metamask3.importWallet(SEED_PHRASE)
    cypressPage = context2.pages()[extensionPageIndex === 1 ? 0 : 1]
    await cypressPage.bringToFront()
  }
  return {
    context: context2,
    extensionPage,
    cypressPage,
    metamaskExtensionId: metamaskExtensionId2,
  }
}

// src/cypress/support/initMetaMask.ts
async function initMetaMask() {
  const metamaskPath = await prepareExtension(false)
  const extensions = [metamaskPath]
  const browserArgs = []
  if (process.env.HEADLESS) {
    browserArgs.push('--headless=new')
  }
  return { extensions, browserArgs }
}

// src/cypress/configureSynpress.ts
var metamask2
var rdpPort
var context
var metamaskExtensionId
var metamaskExtensionPage
function configureSynpress(on, config, importDefaultWallet = true) {
  const browsers = config.browsers.filter((b) => b.name === 'chrome')
  if (browsers.length === 0) {
    throw new Error('No Chrome browser found in the configuration')
  }
  on('before:browser:launch', async (browser, launchOptions) => {
    const args = Array.isArray(launchOptions)
      ? launchOptions
      : launchOptions.args
    rdpPort = ensureRdpPort(args)
    if (browser.family === 'chromium') {
      const { extensions, browserArgs } = await initMetaMask()
      launchOptions.extensions.push(...extensions)
      args.push(...browserArgs)
    }
    return launchOptions
  })
  on('before:spec', async () => {
    if (!metamask2) {
      const {
        context: _context,
        metamaskExtensionId: _metamaskExtensionId,
        extensionPage: _extensionPage,
        cypressPage: _cypressPage,
      } = await importMetaMaskWallet(rdpPort, importDefaultWallet)
      if (_extensionPage && _metamaskExtensionId) {
        context = _context
        metamaskExtensionId = _metamaskExtensionId
        metamaskExtensionPage = _extensionPage
      }
      metamask2 = new MetaMask2(
        context,
        metamaskExtensionPage,
        metamaskExtensionId
      )
    }
  })
  on('task', {
    // Wallet
    connectToDapp: () => metamask2?.connectToDapp(),
    importWallet: (seedPhrase) => metamask2?.importWallet(seedPhrase),
    importWalletFromPrivateKey: (privateKey) =>
      metamask2?.importWalletFromPrivateKey(privateKey),
    // Account
    getAccount: () => metamask2?.getAccount(),
    getAccountAddress: () => metamask2?.getAccountAddress(),
    addNewAccount: (accountName) => metamask2?.addNewAccount(accountName),
    switchAccount: (accountName) => metamask2?.switchAccount(accountName),
    renameAccount: ({ currentAccountName, newAccountName }) =>
      metamask2?.renameAccount({ currentAccountName, newAccountName }),
    resetAccount: () => metamask2?.resetAccount(),
    // Network
    getNetwork: () => metamask2?.getNetwork(),
    switchNetwork: ({ networkName, isTestnet = false }) =>
      metamask2?.switchNetwork({
        networkName,
        isTestnet,
      }),
    addNetwork: (network2) => metamask2?.addNetwork(network2),
    approveNewNetwork: () => metamask2?.approveNewNetwork(),
    approveSwitchNetwork: () => metamask2?.approveSwitchNetwork(),
    approveNewEthereumRPC: () => metamask2?.approveNewEthereumRPC(),
    rejectNewNetwork: () => metamask2?.rejectNewNetwork(),
    rejectSwitchNetwork: () => metamask2?.rejectSwitchNetwork(),
    rejectNewEthereumRPC: () => metamask2?.rejectNewEthereumRPC(),
    // Anvil
    createAnvilNode: (options) => metamask2?.createAnvilNode(options),
    emptyAnvilNode: () => metamask2?.emptyAnvilNode(),
    // Token
    deployToken: () => metamask2?.deployToken(),
    addNewToken: () => metamask2?.addNewToken(),
    approveTokenPermission: (options) =>
      metamask2?.approveTokenPermission(options),
    rejectTokenPermission: () => metamask2?.rejectTokenPermission(),
    // Encryption
    providePublicEncryptionKey: () => metamask2?.providePublicEncryptionKey(),
    decrypt: () => metamask2?.decrypt(),
    // Transactions
    confirmSignature: () => metamask2?.confirmSignature(),
    rejectSignature: () => metamask2?.rejectSignature(),
    confirmTransaction: (options) => metamask2?.confirmTransaction(options),
    rejectTransaction: () => metamask2?.rejectTransaction(),
    confirmTransactionAndWaitForMining: () =>
      metamask2?.confirmTransactionAndWaitForMining(),
    openTransactionDetails: (txIndex) =>
      metamask2?.openTransactionDetails(txIndex),
    closeTransactionDetails: () => metamask2?.closeTransactionDetails(),
    // Lock/Unlock
    lock: () => metamask2?.lock(),
    unlock: () => metamask2?.unlock(),
    // Toggles
    toggleShowTestNetworks: () => metamask2?.toggleShowTestNetworks(),
    toggleDismissSecretRecoveryPhraseReminder: () =>
      metamask2?.toggleDismissSecretRecoveryPhraseReminder(),
    // Others
    goBackToHomePage: () => metamask2?.goBackToHomePage(),
    openSettings: () => metamask2?.openSettings(),
    openSidebarMenu: (menu) => metamask2?.openSidebarMenu(menu),
  })
  return {
    ...config,
    browsers,
  }
}

// src/cypress/support/synpressCommands.ts
function synpressCommandsForMetaMask() {
  Cypress.Commands.add('importWallet', (seedPhrase) => {
    return cy.task('importWallet', seedPhrase)
  })
  Cypress.Commands.add('importWalletFromPrivateKey', (privateKey) => {
    return cy.task('importWalletFromPrivateKey', privateKey)
  })
  Cypress.Commands.add('connectToDapp', () => {
    return cy.task('connectToDapp')
  })
  Cypress.Commands.add('getAccount', () => {
    return cy.task('getAccount')
  })
  Cypress.Commands.add('addNewAccount', (accountName) => {
    return cy.task('addNewAccount', accountName)
  })
  Cypress.Commands.add('switchAccount', (accountName) => {
    return cy.task('switchAccount', accountName)
  })
  Cypress.Commands.add(
    'renameAccount',
    (currentAccountName, newAccountName) => {
      return cy.task('renameAccount', { currentAccountName, newAccountName })
    }
  )
  Cypress.Commands.add('getAccountAddress', () => {
    return cy.task('getAccountAddress')
  })
  Cypress.Commands.add('resetAccount', () => {
    return cy.task('resetAccount')
  })
  Cypress.Commands.add('getNetwork', () => {
    return cy.task('getNetwork')
  })
  Cypress.Commands.add('switchNetwork', (networkName, isTestnet = false) => {
    return cy.task('switchNetwork', { networkName, isTestnet })
  })
  Cypress.Commands.add('createAnvilNode', (options) => {
    return cy.task('createAnvilNode', options)
  })
  Cypress.Commands.add('connectToAnvil', () => {
    return cy.task('createAnvilNode').then((anvilNetwork) => {
      const anvilNetworkDetails = anvilNetwork
      const network2 = {
        name: 'Anvil',
        rpcUrl: anvilNetworkDetails.rpcUrl,
        chainId: anvilNetworkDetails.chainId,
        symbol: 'ETH',
        blockExplorerUrl: 'https://etherscan.io/',
      }
      return cy.task('addNetwork', network2)
    })
  })
  Cypress.Commands.add('emptyAnvilNode', () => {
    return cy.task('emptyAnvilNode')
  })
  Cypress.Commands.add('addNetwork', (network2) => {
    return cy.task('addNetwork', network2)
  })
  Cypress.Commands.add('approveNewNetwork', () => {
    return cy.task('approveNewNetwork')
  })
  Cypress.Commands.add('approveSwitchNetwork', () => {
    return cy.task('approveSwitchNetwork')
  })
  Cypress.Commands.add('rejectNewNetwork', () => {
    return cy.task('rejectNewNetwork')
  })
  Cypress.Commands.add('rejectSwitchNetwork', () => {
    return cy.task('rejectSwitchNetwork')
  })
  Cypress.Commands.add('approveNewEthereumRPC', () => {
    return cy.task('approveNewEthereumRPC')
  })
  Cypress.Commands.add('rejectNewEthereumRPC', () => {
    return cy.task('rejectNewEthereumRPC')
  })
  Cypress.Commands.add('deployToken', () => {
    return cy.task('deployToken')
  })
  Cypress.Commands.add('addNewToken', () => {
    return cy.task('addNewToken')
  })
  Cypress.Commands.add('approveTokenPermission', (options) => {
    return cy.task('approveTokenPermission', options)
  })
  Cypress.Commands.add('rejectTokenPermission', () => {
    return cy.task('rejectTokenPermission')
  })
  Cypress.Commands.add('lock', () => {
    return cy.task('lock')
  })
  Cypress.Commands.add('unlock', () => {
    return cy.task('unlock')
  })
  Cypress.Commands.add('toggleShowTestNetworks', () => {
    return cy.task('toggleShowTestNetworks')
  })
  Cypress.Commands.add('toggleDismissSecretRecoveryPhraseReminder', () => {
    return cy.task('toggleDismissSecretRecoveryPhraseReminder')
  })
  Cypress.Commands.add('providePublicEncryptionKey', () => {
    return cy.task('providePublicEncryptionKey')
  })
  Cypress.Commands.add('decrypt', () => {
    return cy.task('decrypt')
  })
  Cypress.Commands.add('confirmSignature', () => {
    return cy.task('confirmSignature')
  })
  Cypress.Commands.add('rejectSignature', () => {
    return cy.task('rejectSignature')
  })
  Cypress.Commands.add('confirmTransaction', (options) => {
    return cy.task('confirmTransaction', options)
  })
  Cypress.Commands.add('rejectTransaction', () => {
    return cy.task('rejectTransaction')
  })
  Cypress.Commands.add('confirmTransactionAndWaitForMining', () => {
    return cy.task('confirmTransactionAndWaitForMining')
  })
  Cypress.Commands.add('openTransactionDetails', (txIndex = 0) => {
    return cy.task('openTransactionDetails', txIndex)
  })
  Cypress.Commands.add('closeTransactionDetails', () => {
    return cy.task('closeTransactionDetails')
  })
  Cypress.Commands.add('goBackToHomePage', () => {
    return cy.task('goBackToHomePage')
  })
  Cypress.Commands.add('openSettings', () => {
    return cy.task('openSettings')
  })
  Cypress.Commands.add('openSidebarMenu', (menu) => {
    return cy.task('openSidebarMenu', menu)
  })
}

export {
  MetaMask2 as MetaMask,
  configureSynpress,
  initMetaMask,
  synpressCommandsForMetaMask as synpressCommands,
}
//# sourceMappingURL=out.js.map
//# sourceMappingURL=index.js.map
