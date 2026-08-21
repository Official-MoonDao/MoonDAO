> **Legacy process.** Quarterly vMOONEY is now distributed on **Arbitrum** and claimed on the MoonDAO website. Follow [vMOONEY Quarterly Rewards](/docs/Operations/vMooney-Quarterly-Rewards). The Polygon delegation-safe steps below are kept only as a historical record.

## What is a delegation safe?

A delegation safe is a multisig wallet that holds the staked voting power that a contributor earns through the quarterly rewards cycle. 

## Why does MoonDAO use delegation safes?

Delegation safes are necessary in order to ensure that the MOONEY is staked prior to distribution.

## How does it work?

The quarter’s reward pool of MOONEY is transferred to a trusted operator of the executive branch in batches, with each batch remaining under 1/5th the amount of the total pool. The operator creates a delegation safe for each contributor on Polygon. The MOONEY is then bridged to Polygon POS, distributed to the wallets as allocated through the rewards cycle. From there, the MOONEY is staked for 4 years and the voting power is delegated to the contributor’s signing address. Finally, the account is transferred to the sole-ownership of the contributor.

## I lost my delegation wallet address- What do I do?

We advise that you store your delegation wallet address securely alongside your wallet’s secret seed phrase, but if you do happen to lose it, don’t panic! Reach out to a member of the executive branch or post in the [support channel](https://discord.com/channels/914720248140279868/1178835616713154601) and we’ll help you recover the address.

## How do I increase my stake?

Voting power decreases as the unlock date approaches, however you can still increase the staking period to increase your voting power at any time!  
  
1) Go to [Add Safe Account](https://app.safe.global/new-safe/load)
2) Enter the safe address that was assigned to you alongside a descriptive name for the account
3) Connect your wallet (the one used as for the quarter’s payouts) to the dapp
4) In a new tab, go to [the write contract section of Polygon vMOONEY on Polygonscan](https://polygonscan.com/address/0xe2d1BFef0A642B717d294711356b468ccE68BEa6#writeContract) 
5) Click “Connect To Web3” 
6) Click “WalletConnect” 
7) Click the “Copy link” button 
8) Navigate back to the safe tab, and in the apps section, find and open the WalletConnect app
9) Paste in the code copied in step 7 and click “Approve”
10) In a new tab, go to [unix timestamp](https://www.unixtimestamp.com/)
11) Enter the date for the unlock where the stake duration is at maximum 1 hour short of 4 years
12) Click “Convert” and copy the numeric unix timestamp value
13) Navigate back to Polygonscan and click on the contract_lock option
14) Enter the MOONEY amount in fixed-point format in the _value input field

To format the MOONEY amount in fixed-point format, follow this procedure:
a) Format the MOONEY amount as a decimal number  
ie. 250000.5
b) Add zeros at the end of the number until the count of digits after the decimal is 18  
ie. 250000.500000000000000000  
c) Remove the decimal point  
ie. 250000500000000000000000

15) Enter the timestamp code copied in step 13 in the _unlock_time input field
16) Click “Write”
17) Navigate back to safe and sign and execute the transaction

## How do I delegate my voting power to another wallet?

If you change wallets or want to allocate your voting power to someone else, follow these steps.  
  
1) Go to [Add Safe Account](https://app.safe.global/new-safe/load)
2) Enter the safe address that was assigned to you alongside a descriptive account name
3) Connect your wallet (the one used as for the quarter’s payouts) to the dapp
4) Navigate to the apps section and find and open the Snapshot app
5) Search for “MoonDAO” and click the official MoonDAO space in the results
6) Click “Delegate”
7) Enter the preferred address in the “To” input field and click “Confirm”
8) Sign and execute the transaction that appears in the transaction queue  
If this process fails:
1) In a new tab, go to [the write contract section of the snapshot contract on Polygonscan](https://polygonscan.com/address/0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446#writeContract)
2) Click “Connect To Web3” 
3) Click “WalletConnect” 
4) Click the “Copy link” button 
5) Navigate back to the safe tab, and in the apps section, find and open the WalletConnect app
6) Paste in the code copied in step 4 and click “Approve”
7) Navigate back to Polygonscan, and click on “setDelegate”
8) In the ID field enter:  
0x746f6d6f6f6e64616f2e65746800000000000000000000000000000000000000
9) In the delegate input field, enter the preferred EOA wallet address
10) Click “Write”
11) Navigate back to the safe and sign and execute the transaction

## How do I withdraw my MOONEY after the staking period?

MOONEY distributed through the quarterly rewards cycle is unlocked after a 4-year staking period.  
  
1) Go to [Add Safe Account](https://app.safe.global/new-safe/load)
2) Enter the safe address that was assigned to you alongside a descriptive account name
3) Connect your wallet (the one used as for the quarter’s payouts) to the dapp
4) Click “New Transaction” and then “Send Tokens”
5) Enter the address to transfer to in the recipient input field
6) Select “MOONEY” from the asset dropdown
7) Enter the amount to withdraw in the amount input field or click “MAX” to send all tokens
8) Sign and execute the transaction
