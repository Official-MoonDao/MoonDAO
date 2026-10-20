# Card and Apple Pay on Extend Citizenship

Scoping note only. This branch does not change the payment path.

## What exists

The extend modal (`SubscriptionModal`) prices the extension in ETH on Arbitrum and sends `renew` or `renewSubscription` from the connected wallet. If the wallet is short, it opens `FundOnrampModal`.

`FundOnramp` is the onramp:

- United States: Coinbase, Apple Pay or Google Pay, no Coinbase account. Guest debit-card checkout on Coinbase is already deprecated in this UI.
- Everywhere else: MoonPay by default (debit or credit card, Apple Pay, Google Pay, or bank transfer). Coinbase is the alternate for people who already have an account.

That path buys ETH, then the same wallet transaction pays the extension. It is not a card charge for the citizenship price itself.

## Files

- `ui/components/subscription/SubscriptionModal.tsx`: shortfall check, `FundOnrampModal`, and the retry in `onBalanceSufficient`.
- `ui/components/onramp/FundOnrampModal.tsx` and `ui/components/onramp/FundOnramp.tsx`: provider choice.
- `ui/components/coinbase/CBHeadlessOnramp.tsx` and `ui/components/moonpay/MoonPayOnramp.tsx`: the embedded checkouts.
- `ui/lib/subscription/citizenCheckout.ts`: the ETH checkout total once that contract is live.
- `ui/lib/onramp/onrampReturn.ts` and `ui/components/onramp/OnrampReturnHandler.tsx`: return after MoonPay, which has no return URL of its own.

## Missing piece

The primary button still starts a wallet transaction. The onramp appears only after a balance check fails. A card or Apple Pay choice should be visible before that prompt, then return to the same modal and submit the extension once the ETH arrives.

## Risks

- The extension is still an Arbitrum transaction after the onramp. An embedded Privy wallet can sign it. A social login with no wallet cannot finish.
- Coinbase and MoonPay can stop on KYC. That drop is outside this repo.
- A successful onramp plus a second click can send the extension twice. The retry has to be single-flight.
- MoonPay does not return to the modal by itself. The existing return handler has to land back on the page that opened the modal, with the years selection still there.
- Do not collect card numbers in this app. Keep that inside Coinbase or MoonPay.
- Apple Pay without an account is the US Coinbase path. Other regions use MoonPay for a card.

## Size

Medium. No new processor. The work is a pay choice in the extend modal, a single-flight resume after funding, and a check that the signed-out email landing still reaches this modal after sign-in. The chain call stays the current ETH extension.
