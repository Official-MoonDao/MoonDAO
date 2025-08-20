// import { OWNS_CITIZEN_VERIFIER_ADDRESSES, XP_ORACLE_CHAIN } from 'const/config'
// import { utils as ethersUtils } from 'ethers'
// import { authMiddleware } from 'middleware/authMiddleware'
// import withMiddleware from 'middleware/withMiddleware'
// import type { NextApiRequest, NextApiResponse } from 'next'
// import { getContract, readContract } from 'thirdweb'
// import { Address, Hex } from 'thirdweb'
// import { arbitrum, sepolia } from '@/lib/infura/infuraChains'
// import { addressBelongsToPrivyUser } from '@/lib/privy'
// import { serverClient } from '@/lib/thirdweb/client'
// import { signOwnsCitizenProof, submitOwnsCitizenClaimFor } from '@/lib/xp'

// const OWNS_CITIZEN_ABI = [
//   {
//     type: 'function',
//     name: 'isEligible',
//     stateMutability: 'view',
//     inputs: [
//       { name: 'user', type: 'address' },
//       { name: 'context', type: 'bytes' },
//     ],
//     outputs: [{ type: 'bool' }, { type: 'uint256' }],
//   },
// ]

// async function handler(req: NextApiRequest, res: NextApiResponse) {
//   try {
//     if (req.method !== 'POST')
//       return res.status(405).json({ error: 'Method not allowed' })

//     const { user, accessToken } = JSON.parse(req.body) as {
//       user?: string
//       accessToken?: string
//     }
//     if (!user || !ethersUtils.isAddress(user))
//       return res.status(400).json({ error: 'Invalid user address' })

//     if (!addressBelongsToPrivyUser(accessToken as string, user))
//       return res.status(400).json({ error: 'User not found' })

//     // Pre-check eligibility on-chain via the verifier to avoid wasting gas
//     try {
//       const twChain =
//         process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
//       const verifierAddress = OWNS_CITIZEN_VERIFIER_ADDRESSES[
//         XP_ORACLE_CHAIN
//       ] as Address
//       if (!verifierAddress)
//         return res
//           .status(500)
//           .json({ error: 'Verifier address not configured' })

//       const contract = getContract({
//         client: serverClient,
//         chain: twChain,
//         address: verifierAddress,
//         abi: OWNS_CITIZEN_ABI as any,
//       })

//       // For eligibility check, we just need to pass some context (xpAmount is determined by the verifier)
//       const dummyContext = ethersUtils.defaultAbiCoder.encode(
//         ['uint256'],
//         ['1'] // dummy value for eligibility check
//       ) as Hex

//       const [eligible, xpFromContract] = (await readContract({
//         contract,
//         method: 'isEligible',
//         params: [user as Address, dummyContext],
//       })) as unknown as [boolean, bigint]

//       if (!eligible)
//         return res.status(200).json({ eligible: false, xpAmount: '0' })
//     } catch (e: any) {
//       return res
//         .status(500)
//         .json({ error: e?.message || 'Eligibility pre-check failed' })
//     }

//     // Sign the proof using the new oracle system
//     const { validAfter, validBefore, signature, context } =
//       await signOwnsCitizenProof({
//         user: user as Address,
//       })

//     // Submit the claim on behalf of the user
//     const { txHash } = await submitOwnsCitizenClaimFor({
//       user: user as Address,
//       context,
//     })

//     // Decode xp from context for client convenience (index 0 for OwnsCitizenNFT)
//     const [xpAmount] = ethersUtils.defaultAbiCoder.decode(
//       ['uint256', 'uint256', 'uint256', 'bytes'],
//       context
//     ) as unknown[] as [bigint]

//     return res.status(200).json({
//       eligible: true,
//       xpAmount: (xpAmount as bigint).toString(),
//       validAfter: Number(validAfter),
//       validBefore: Number(validBefore),
//       signature,
//       context,
//       txHash,
//     })
//   } catch (err: any) {
//     return res.status(500).json({ error: err?.message || 'Internal error' })
//   }
// }

// export default withMiddleware(handler as any, authMiddleware)
