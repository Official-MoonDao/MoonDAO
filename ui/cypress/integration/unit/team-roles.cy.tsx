import { ethers } from 'ethers'
import HatsABI from '../../../const/abis/Hats.json'
import {
  buildAddRoleTx,
  buildRemoveRoleTx,
  getRoleLabel,
  getRoleTxRouting,
  isAdminHat,
  isManagerHat,
  isValidEthereumAddress,
  requiresSafeTx,
  toHatIdHex,
  wouldRemoveLastManager,
} from '@/lib/hats/teamRoles'

// Hat ids are uint256 values. The subgraph returns them as 0x-prefixed,
// zero-padded 64-char lowercase hex; the team contract returns them as decimals.
// We model a realistic tree: admin hat -> manager sub-hat -> member sub-hat,
// and derive the decimal form (as the contract would return) from each hex.
const ADMIN_HAT_HEX =
  '0x0000000100000000000000000000000000000000000000000000000000000000'
const MANAGER_HAT_HEX =
  '0x0000000100010000000000000000000000000000000000000000000000000000'
const MEMBER_HAT_HEX =
  '0x0000000100010001000000000000000000000000000000000000000000000000'

const ADMIN_HAT_DECIMAL = BigInt(ADMIN_HAT_HEX).toString()
const MANAGER_HAT_DECIMAL = BigInt(MANAGER_HAT_HEX).toString()

describe('teamRoles', () => {
  describe('toHatIdHex', () => {
    it('produces a 0x-prefixed, 66-char (32-byte) lowercase hex string', () => {
      const hex = toHatIdHex(ADMIN_HAT_DECIMAL)
      expect(hex).to.match(/^0x[0-9a-f]{64}$/)
      expect(hex.length).to.equal(66)
    })

    it('accepts decimal strings, numbers, and bigints equivalently', () => {
      expect(toHatIdHex('255')).to.equal(toHatIdHex(255))
      expect(toHatIdHex(255)).to.equal(toHatIdHex(BigInt(255)))
      expect(toHatIdHex('255')).to.equal(
        '0x00000000000000000000000000000000000000000000000000000000000000ff'
      )
    })

    it('zero-pads small ids to a full 32-byte word', () => {
      expect(toHatIdHex(1)).to.equal(
        '0x0000000000000000000000000000000000000000000000000000000000000001'
      )
    })
  })

  describe('isManagerHat', () => {
    it('matches the manager hat regardless of source format', () => {
      expect(isManagerHat(MANAGER_HAT_HEX, MANAGER_HAT_DECIMAL)).to.equal(true)
      expect(isManagerHat(MANAGER_HAT_HEX, BigInt(MANAGER_HAT_DECIMAL))).to.equal(
        true
      )
    })

    it('is case-insensitive on the incoming hex id', () => {
      expect(
        isManagerHat(MANAGER_HAT_HEX.toUpperCase(), MANAGER_HAT_DECIMAL)
      ).to.equal(true)
    })

    it('does not match the admin or member hats', () => {
      expect(isManagerHat(ADMIN_HAT_HEX, MANAGER_HAT_DECIMAL)).to.equal(false)
      expect(isManagerHat(MEMBER_HAT_HEX, MANAGER_HAT_DECIMAL)).to.equal(false)
    })

    it('returns false for nullish inputs', () => {
      expect(isManagerHat(null, MANAGER_HAT_DECIMAL)).to.equal(false)
      expect(isManagerHat(MANAGER_HAT_HEX, null)).to.equal(false)
      expect(isManagerHat(undefined, undefined)).to.equal(false)
    })
  })

  describe('isAdminHat', () => {
    it('matches the admin hat', () => {
      expect(isAdminHat(ADMIN_HAT_HEX, ADMIN_HAT_DECIMAL)).to.equal(true)
    })

    it('does not match the manager or member hats', () => {
      expect(isAdminHat(MANAGER_HAT_HEX, ADMIN_HAT_DECIMAL)).to.equal(false)
      expect(isAdminHat(MEMBER_HAT_HEX, ADMIN_HAT_DECIMAL)).to.equal(false)
    })
  })

  describe('requiresSafeTx / getRoleTxRouting', () => {
    it('routes the manager hat through the Safe', () => {
      expect(
        requiresSafeTx(MANAGER_HAT_HEX, MANAGER_HAT_DECIMAL, ADMIN_HAT_DECIMAL)
      ).to.equal(true)
      expect(
        getRoleTxRouting(MANAGER_HAT_HEX, MANAGER_HAT_DECIMAL, ADMIN_HAT_DECIMAL)
      ).to.equal('safe')
    })

    it('routes the admin hat through the Safe (defensive: removal only)', () => {
      expect(
        requiresSafeTx(ADMIN_HAT_HEX, MANAGER_HAT_DECIMAL, ADMIN_HAT_DECIMAL)
      ).to.equal(true)
      expect(
        getRoleTxRouting(ADMIN_HAT_HEX, MANAGER_HAT_DECIMAL, ADMIN_HAT_DECIMAL)
      ).to.equal('safe')
    })

    it('routes the member hat directly through the connected wallet', () => {
      expect(
        requiresSafeTx(MEMBER_HAT_HEX, MANAGER_HAT_DECIMAL, ADMIN_HAT_DECIMAL)
      ).to.equal(false)
      expect(
        getRoleTxRouting(MEMBER_HAT_HEX, MANAGER_HAT_DECIMAL, ADMIN_HAT_DECIMAL)
      ).to.equal('direct')
    })
  })

  describe('isValidEthereumAddress', () => {
    it('accepts a well-formed checksummed-or-lowercase address', () => {
      expect(
        isValidEthereumAddress('0x214d7C65b9C64f4Db9f2891D29c0a8cf7a5155b7')
      ).to.equal(true)
      expect(
        isValidEthereumAddress('0x0000000000000000000000000000000000000000')
      ).to.equal(true)
    })

    it('rejects wrong length', () => {
      expect(isValidEthereumAddress('0x123')).to.equal(false)
      expect(
        isValidEthereumAddress('0x214d7C65b9C64f4Db9f2891D29c0a8cf7a5155b7ab')
      ).to.equal(false)
    })

    it('rejects a missing 0x prefix', () => {
      expect(
        isValidEthereumAddress('214d7C65b9C64f4Db9f2891D29c0a8cf7a5155b700')
      ).to.equal(false)
    })

    it('rejects non-hex characters', () => {
      expect(
        isValidEthereumAddress('0xZZZZ7C65b9C64f4Db9f2891D29c0a8cf7a5155b7')
      ).to.equal(false)
    })

    it('rejects nullish / non-string input', () => {
      expect(isValidEthereumAddress(null)).to.equal(false)
      expect(isValidEthereumAddress(undefined)).to.equal(false)
      expect(isValidEthereumAddress('')).to.equal(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Transaction simulation: build the descriptor, then encode + decode the real
  // calldata against the actual Hats ABI to prove the exact bytes that would be
  // broadcast for each action (target, function selector, args, routing).
  // ---------------------------------------------------------------------------
  describe('transaction simulation (real Hats calldata)', () => {
    const HATS_ADDRESS = '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137'
    const PASSTHROUGH_MODULE = '0x1111111111111111111111111111111111111111'
    const NEW_MEMBER = '0x214d7c65b9c64f4db9f2891d29c0a8cf7a5155b7'
    const EXISTING_WEARER = '0xf85cd9a72f6ee4b07a428bbce9de9c9f0404ce30'

    // The full Hats ABI contains duplicate error fragments that ethers v5's
    // Interface rejects, so we build the interface from the real `mintHat` and
    // `setHatWearerStatus` *function* fragments only. Selectors and encoding are
    // determined solely by the function signature, so this is byte-identical to
    // encoding against the deployed contract.
    const txFragments = (HatsABI as any[]).filter(
      (f) =>
        f.type === 'function' &&
        (f.name === 'mintHat' || f.name === 'setHatWearerStatus')
    )
    const iface = new ethers.utils.Interface(txFragments)

    function encode(tx: { functionName: string; args: any[] }) {
      return iface.encodeFunctionData(tx.functionName, tx.args)
    }

    it('ADD MEMBER -> direct mintHat on the Hats contract', () => {
      const tx = buildAddRoleTx({
        hatId: MEMBER_HAT_HEX,
        memberAddress: NEW_MEMBER,
        managerHatId: MANAGER_HAT_DECIMAL,
        adminHatId: ADMIN_HAT_DECIMAL,
        hatsAddress: HATS_ADDRESS,
      })

      expect(tx.to).to.equal(HATS_ADDRESS)
      expect(tx.functionName).to.equal('mintHat')
      expect(tx.routing).to.equal('direct')

      // Encode then decode the real calldata to confirm it is well-formed.
      const data = encode(tx)
      const parsed = iface.decodeFunctionData('mintHat', data)
      expect(parsed[0].toString()).to.equal(BigInt(MEMBER_HAT_HEX).toString())
      expect(parsed[1]).to.equal(ethers.utils.getAddress(NEW_MEMBER))
    })

    it('ADD MANAGER -> Safe-queued mintHat on the Hats contract', () => {
      const tx = buildAddRoleTx({
        hatId: MANAGER_HAT_HEX,
        memberAddress: NEW_MEMBER,
        managerHatId: MANAGER_HAT_DECIMAL,
        adminHatId: ADMIN_HAT_DECIMAL,
        hatsAddress: HATS_ADDRESS,
      })

      expect(tx.to).to.equal(HATS_ADDRESS)
      expect(tx.functionName).to.equal('mintHat')
      expect(tx.routing).to.equal('safe')

      const data = encode(tx)
      const parsed = iface.decodeFunctionData('mintHat', data)
      expect(parsed[0].toString()).to.equal(BigInt(MANAGER_HAT_HEX).toString())
      expect(parsed[1]).to.equal(ethers.utils.getAddress(NEW_MEMBER))
    })

    it('REMOVE MEMBER -> direct setHatWearerStatus on the passthrough module', () => {
      const tx = buildRemoveRoleTx({
        hatId: MEMBER_HAT_HEX,
        wearerAddress: EXISTING_WEARER,
        managerHatId: MANAGER_HAT_DECIMAL,
        adminHatId: ADMIN_HAT_DECIMAL,
        hatsAddress: HATS_ADDRESS,
        memberPassthroughModuleAddress: PASSTHROUGH_MODULE,
      })

      // Member removal must NOT go to the Hats contract; only the eligibility
      // module (passthrough) may call setHatWearerStatus.
      expect(tx.to).to.equal(PASSTHROUGH_MODULE)
      expect(tx.to).to.not.equal(HATS_ADDRESS)
      expect(tx.functionName).to.equal('setHatWearerStatus')
      expect(tx.routing).to.equal('direct')

      const data = encode(tx)
      const parsed = iface.decodeFunctionData('setHatWearerStatus', data)
      expect(parsed[0].toString()).to.equal(BigInt(MEMBER_HAT_HEX).toString())
      expect(parsed[1]).to.equal(ethers.utils.getAddress(EXISTING_WEARER))
      expect(parsed[2]).to.equal(false) // eligible = false (revoke)
      expect(parsed[3]).to.equal(true) // standing = true (no slash)
    })

    it('REMOVE MANAGER -> Safe-queued setHatWearerStatus on the Hats contract', () => {
      const tx = buildRemoveRoleTx({
        hatId: MANAGER_HAT_HEX,
        wearerAddress: EXISTING_WEARER,
        managerHatId: MANAGER_HAT_DECIMAL,
        adminHatId: ADMIN_HAT_DECIMAL,
        hatsAddress: HATS_ADDRESS,
        memberPassthroughModuleAddress: PASSTHROUGH_MODULE,
      })

      // Manager removal goes through the Safe (the manager hat's eligibility
      // module), targeting the Hats contract directly.
      expect(tx.to).to.equal(HATS_ADDRESS)
      expect(tx.functionName).to.equal('setHatWearerStatus')
      expect(tx.routing).to.equal('safe')

      const data = encode(tx)
      const parsed = iface.decodeFunctionData('setHatWearerStatus', data)
      expect(parsed[0].toString()).to.equal(BigInt(MANAGER_HAT_HEX).toString())
      expect(parsed[1]).to.equal(ethers.utils.getAddress(EXISTING_WEARER))
      expect(parsed[2]).to.equal(false)
      expect(parsed[3]).to.equal(true)
    })

    it('produces distinct selectors for mint vs. remove', () => {
      const mint = encode(
        buildAddRoleTx({
          hatId: MEMBER_HAT_HEX,
          memberAddress: NEW_MEMBER,
          managerHatId: MANAGER_HAT_DECIMAL,
          adminHatId: ADMIN_HAT_DECIMAL,
          hatsAddress: HATS_ADDRESS,
        })
      )
      const remove = encode(
        buildRemoveRoleTx({
          hatId: MEMBER_HAT_HEX,
          wearerAddress: EXISTING_WEARER,
          managerHatId: MANAGER_HAT_DECIMAL,
          adminHatId: ADMIN_HAT_DECIMAL,
          hatsAddress: HATS_ADDRESS,
          memberPassthroughModuleAddress: PASSTHROUGH_MODULE,
        })
      )
      // First 4 bytes (8 hex chars after 0x) are the function selector.
      expect(mint.slice(0, 10)).to.not.equal(remove.slice(0, 10))
      expect(mint.slice(0, 10)).to.equal(
        iface.getSighash('mintHat')
      )
      expect(remove.slice(0, 10)).to.equal(
        iface.getSighash('setHatWearerStatus')
      )
    })
  })

  describe('wouldRemoveLastManager', () => {
    it('blocks removing the manager hat when only one manager remains', () => {
      expect(
        wouldRemoveLastManager(MANAGER_HAT_HEX, MANAGER_HAT_DECIMAL, 1)
      ).to.equal(true)
      expect(
        wouldRemoveLastManager(MANAGER_HAT_HEX, MANAGER_HAT_DECIMAL, 0)
      ).to.equal(true)
    })

    it('allows removing a manager when others remain', () => {
      expect(
        wouldRemoveLastManager(MANAGER_HAT_HEX, MANAGER_HAT_DECIMAL, 2)
      ).to.equal(false)
    })

    it('never blocks removing a non-manager (member) hat', () => {
      expect(
        wouldRemoveLastManager(MEMBER_HAT_HEX, MANAGER_HAT_DECIMAL, 1)
      ).to.equal(false)
      expect(
        wouldRemoveLastManager(MEMBER_HAT_HEX, MANAGER_HAT_DECIMAL, 0)
      ).to.equal(false)
    })
  })

  describe('getRoleLabel', () => {
    it('labels the manager hat deterministically, ignoring IPFS metadata', () => {
      expect(
        getRoleLabel(MANAGER_HAT_HEX, {
          managerHatId: MANAGER_HAT_DECIMAL,
          ipfsName: undefined,
        })
      ).to.equal('Manager')
      // Even if IPFS returned an odd name, the manager hat stays "Manager".
      expect(
        getRoleLabel(MANAGER_HAT_HEX, {
          managerHatId: MANAGER_HAT_DECIMAL,
          ipfsName: 'Some Custom Name',
        })
      ).to.equal('Manager')
    })

    it('uses the IPFS name for non-manager hats when available', () => {
      expect(
        getRoleLabel(MEMBER_HAT_HEX, {
          managerHatId: MANAGER_HAT_DECIMAL,
          ipfsName: 'Member',
        })
      ).to.equal('Member')
    })

    it('falls back to "Member" when IPFS metadata is missing', () => {
      expect(
        getRoleLabel(MEMBER_HAT_HEX, {
          managerHatId: MANAGER_HAT_DECIMAL,
          ipfsName: undefined,
        })
      ).to.equal('Member')
    })
  })
})
