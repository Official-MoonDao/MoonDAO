# Toast Messages Changelog

All toast messages updated to be more informative yet concise (~40–70 chars).

---

## `pages/lock.tsx`
| Old | New |
|-----|-----|
| `Successfully approved MOONEY for lock.` | `MOONEY approved — ready to lock.` |
| `Lock increased successfully!` | `vMOONEY lock increased — voting power updated!` |
| `Lock created successfully!` | `MOONEY locked — you now have vMOONEY voting power!` |
| `Lock period exceeds maximum allowed time...` | `Lock period exceeds the maximum of 4 years...` |
| `Successfully withdrew your locked MOONEY.` | `Locked MOONEY withdrawn to your wallet.` |
| `Withdrawal failed.` | `Withdrawal failed — lock may not have expired yet.` |

## `lib/mission/useManagerActions.ts`
| Old | New |
|-----|-----|
| `Tokens sent.` | `Reserved tokens distributed to recipients!` |
| `No tokens to send.` | `Token distribution failed — no tokens available.` |
| `Payouts sent.` | `Payouts sent to all recipients!` |
| `No payouts to send.` | `Payout failed — no available balance to distribute.` |
| `Liquidity pool deployed.` | `Liquidity pool deployed and liquidity added!` |
| `Failed to deploy liquidity pool.` | `Liquidity pool deployment failed. Please try again.` |

## `components/uniswap/NativeToMooney.tsx`
| Old | New |
|-----|-----|
| `Enter an amount.` | `Please enter an amount greater than zero to swap.` |
| `No route found.` | `No swap route available. Try a different amount.` |
| `Insufficient balance.` | `Insufficient balance — not enough ETH for this swap.` |
| `Swap completed successfully!` | `Swap completed! MOONEY incoming.` |
| `Swap failed. Please try again.` | `Swap failed — transaction rejected or price slipped.` |

## `components/uniswap/MissionTokenSwapV4.tsx`
| Old | New |
|-----|-----|
| `Enter amount` | `Please enter a valid amount to swap.` |
| `Swap submitted` | `Successfully swapped for $<TOKEN> tokens!` |
| `Swap failed` | `Swap failed. Check your balance and try again.` |

## `components/onboarding/ApplyModal.tsx`
| Old | New |
|-----|-----|
| `Application submitted!` | `Application submitted — we'll be in touch!` |

## `components/nodemailer/ZeroGContact.tsx`
| Old | New |
|-----|-----|
| `Please fill out all required fields.` | `Please enter a valid email and name.` |
| `Please verify you're not a robot.` | `Please complete the CAPTCHA to continue.` |
| `Message sent!` | `Message sent! We'll get back to you soon.` |
| `Message failed to send.` | `Message failed to send. Please try again.` |

## `components/thirdweb/AllowanceWarning.tsx`
| Old | New |
|-----|-----|
| `Allowance revoked.` | `Token allowance revoked.` |

## `pages/fees.tsx`
| Old | New |
|-----|-----|
| `Checked in!` | `You're checked in for this week's reward pool! 🎉` |
| `Error checking in. Please try again.` | `Check-in failed — ensure you have vMOONEY and gas.` |

## `components/mission/VestingCard.tsx`
| Old | New |
|-----|-----|
| `Withdrawal successful!` | `Vested tokens withdrawn to your wallet!` |
| `Withdrawal failed.` | `Withdrawal failed — tokens may not have vested yet.` |

## `components/mission/MissionDeployTokenModal.tsx`
| Old | New |
|-----|-----|
| `Error deploying token` | `Token deployment failed. Check gas and try again.` |

## `pages/team/[tokenIdOrName].tsx`
| Old | New |
|-----|-----|
| `Connect the entity admin wallet or multisig to edit metadata.` | `Connect the team admin or multisig wallet to edit.` |

## `pages/citizen/[tokenIdOrName].tsx`
| Old | New |
|-----|-----|
| `Connect the entity admin wallet or multisig to edit metadata.` | `Connect the profile owner wallet to edit.` |

## `components/subscription/TeamManageMembers.tsx`
| Old | New |
|-----|-----|
| `Invalid address.` | `Please enter a valid Ethereum address (0x...).` |
| `Member added successfully!` | `Member added and role granted!` |
| `The connected wallet is not a signer of the gnosis safe.` | `Not a Safe signer. Connect an authorized wallet.` |
| `Member removed successfully!` | `Member removed and role access revoked.` |
| `Hat added successfully` | `New role added to the team!` |

## `components/subscription/DeleteProfileData.tsx`
| Old | New |
|-----|-----|
| `Data deleted successfully, please wait for the page to reload.` | `Profile data deleted. Page will reload shortly.` |

## `lib/thirdweb/addNetworkToWallet.ts`
| Old | New |
|-----|-----|
| `No Ethereum provider found.` | `No wallet detected. Please install a Web3 wallet.` |
| `Please add the network to continue.` | `Network request declined. Approve it in your wallet.` |

## `components/thirdweb/NetworkSelector.tsx`
| Old | New |
|-----|-----|
| `Failed to switch network. Please try again.` | `Network switch failed. Try again or switch manually.` |

## `components/onboarding/CitizenTier.tsx`
| Old | New |
|-----|-----|
| `You have already registered as a citizen.` | `This wallet is already registered as a citizen.` |

## `components/newsletter/NewsletterSubModal.tsx`
| Old | New |
|-----|-----|
| `Please enter a valid email` | `Please enter a valid email to subscribe.` |

## `pages/governance.tsx`
| Old | New |
|-----|-----|
| `Please select a privy wallet to export.` | `No Privy wallet found. Select one before exporting.` |

## `components/contribution/ContributionEditor.tsx`
| Old | New |
|-----|-----|
| `Please sign in to submit a contribution!` | `Please sign in to submit a contribution.` |
| `Please write a contribution!` | `Please describe your contribution before submitting.` |
| `Contribution submitted successfully!` | `Contribution recorded — thank you!` |

## `components/onboarding/CreateCitizen.tsx`
| Old | New |
|-----|-----|
| `Error pinning image to IPFS.` | `Image upload to IPFS failed. Try a smaller file.` |
| `Could not find mint event in transaction.` | `Mint unverified — check your wallet or contact support.` |

## `components/onboarding/CreateTeam.tsx`
| Old | New |
|-----|-----|
| `Error pinning image to IPFS.` | `Image upload to IPFS failed. Try a smaller file.` |
| `Could not find mint event in transaction.` | `Mint unverified — check your wallet or contact support.` |

## `components/subscription/TeamTreasury.tsx`
| Old | New |
|-----|-----|
| `Address copied to clipboard.` | `Treasury address copied to clipboard!` |

## `pages/overview-vote.tsx`
| Old | New |
|-----|-----|
| `Delegation submitted!` | `Delegation successful! Votes assigned to selected citizen.` |

## `lib/tokens/hooks/useRetroactiveRewards.tsx`
| Old | New |
|-----|-----|
| `Please connect your wallet.` | `Connect your wallet to claim retroactive rewards.` |
| `Withdrawal successful!` | `Retroactive rewards withdrawn to your wallet!` |

## `lib/xp/config.ts`
| Old | New |
|-----|-----|
| `Referral link copied to clipboard!` | `Referral link copied — share it to earn XP!` |

## `components/subscription/TeamListing.tsx`
| Old | New |
|-----|-----|
| `Error deleting listing.` | `Failed to delete listing. Please try again.` |

## `components/subscription/BuyTeamListingModal.tsx`
| Old | New |
|-----|-----|
| `Successful purchase! You'll receive an email shortly.` | `Purchase complete! Confirmation email on the way.` |
| `Something went wrong, please contact support.` | `Purchase failed. Please contact support.` |

## `components/nance/DePrize.tsx`
| Old | New |
|-----|-----|
| `Joined as a competitor!` | `Joined as a DePrize competitor — good luck!` |
| `Error joining as a competitor. Please try again.` | `Failed to join. Check eligibility and try again.` |
