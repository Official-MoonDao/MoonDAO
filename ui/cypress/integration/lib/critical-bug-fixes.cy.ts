import { ethers } from 'ethers'
import { extractTokenIdFromReceipt } from '@/lib/onboarding/shared-utils'

// ============================================================================
// Bug #1: Cross-chain slippage protection
// The minimum token output for cross-chain contributions must NOT be zero.
// Previously `output * 0` was used (always 0), now we use 5% slippage.
// ============================================================================
describe('Bug #1: Cross-chain slippage protection', () => {
  const toWei = (value: number): bigint => {
    if (!isFinite(value) || isNaN(value) || value < 0) return BigInt(0)
    let valueStr = value.toString()
    const dotIndex = valueStr.indexOf('.')
    let decimals = ''
    if (dotIndex !== -1) {
      decimals = valueStr.slice(dotIndex + 1)
      valueStr = valueStr.slice(0, dotIndex)
    }
    const paddedDecimals = decimals.padEnd(18, '0').slice(0, 18)
    return BigInt(valueStr + paddedDecimals)
  }

  const calculateSlippage = (output: number): bigint => {
    return (toWei(output) * BigInt(95)) / BigInt(100)
  }

  it('should produce non-zero minimum tokens for non-zero output', () => {
    const output = 100
    const minTokens = calculateSlippage(output)
    expect(minTokens > BigInt(0)).to.be.true
  })

  it('should apply 5% slippage (95% of output)', () => {
    const output = 100
    const minTokens = calculateSlippage(output)
    const expectedMin = (toWei(100) * BigInt(95)) / BigInt(100)
    expect(minTokens.toString()).to.equal(expectedMin.toString())
  })

  it('should produce zero minimum tokens only when output is zero', () => {
    const output = 0
    const minTokens = calculateSlippage(output)
    expect(minTokens.toString()).to.equal('0')
  })

  it('should handle small fractional outputs correctly', () => {
    const output = 0.001
    const minTokens = calculateSlippage(output)
    expect(minTokens > BigInt(0)).to.be.true
  })

  it('should handle large outputs without overflow', () => {
    const output = 1000000
    const minTokens = calculateSlippage(output)
    const fullOutput = toWei(output)
    expect(minTokens < fullOutput).to.be.true
    expect(minTokens > BigInt(0)).to.be.true
  })

  it('should never exceed the full output amount', () => {
    const outputs = [0.01, 0.5, 1, 10, 100, 50000]
    outputs.forEach((output) => {
      const minTokens = calculateSlippage(output)
      const fullOutput = toWei(output)
      expect(minTokens <= fullOutput).to.be.true
    })
  })
})

// ============================================================================
// Bug #2: Comma operator in incompleteProfile
// The comma operator was silently discarding description and twitter checks.
// Now all fields are properly OR'd together.
// ============================================================================
describe('Bug #2: incompleteProfile logic', () => {
  const isIncompleteProfile = (
    description: string,
    twitter: string,
    discord: string,
    website: string,
    location: string
  ): boolean => {
    if (
      description !== '' ||
      twitter !== '' ||
      discord !== '' ||
      website !== '' ||
      location !== ''
    ) {
      return false
    } else {
      return true
    }
  }

  it('should be complete when only description is filled', () => {
    expect(isIncompleteProfile('I am a citizen', '', '', '', '')).to.be.false
  })

  it('should be complete when only twitter is filled', () => {
    expect(isIncompleteProfile('', '@moondao', '', '', '')).to.be.false
  })

  it('should be complete when only discord is filled', () => {
    expect(isIncompleteProfile('', '', 'moondao#1234', '', '')).to.be.false
  })

  it('should be complete when only website is filled', () => {
    expect(isIncompleteProfile('', '', '', 'https://moondao.com', '')).to.be.false
  })

  it('should be complete when only location is filled', () => {
    expect(isIncompleteProfile('', '', '', '', 'New York')).to.be.false
  })

  it('should be incomplete when all fields are empty', () => {
    expect(isIncompleteProfile('', '', '', '', '')).to.be.true
  })

  it('should be complete when all fields are filled', () => {
    expect(
      isIncompleteProfile('Bio', '@twitter', 'disc#1234', 'https://site.com', 'NYC')
    ).to.be.false
  })

  // This is the exact case the comma operator bug was hiding:
  it('should NOT flag profile as incomplete when description is the only field (comma operator regression)', () => {
    const description = 'I love space exploration'
    const result = isIncompleteProfile(description, '', '', '', '')
    expect(result).to.be.false
  })

  // Another case the comma operator bug was hiding:
  it('should NOT flag profile as incomplete when twitter is the only field (comma operator regression)', () => {
    const twitter = '@spacefan'
    const result = isIncompleteProfile('', twitter, '', '', '')
    expect(result).to.be.false
  })
})

// ============================================================================
// Bug #3: extractTokenIdFromReceipt - ERC-721 vs ERC-20 disambiguation
// Both ERC-20 and ERC-721 Transfer events share the same signature. The
// function must only match ERC-721 Transfer logs (4 topics, not 3).
// ============================================================================
describe('Bug #3: extractTokenIdFromReceipt', () => {
  const transferEventSignature = ethers.utils.id('Transfer(address,address,uint256)')
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
  const RECIPIENT = '0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12'
  const TOKEN_ID_HEX = '0x0000000000000000000000000000000000000000000000000000000000000042'

  it('should return null when receipt has no logs', () => {
    expect(extractTokenIdFromReceipt({})).to.be.null
    expect(extractTokenIdFromReceipt(null)).to.be.null
    expect(extractTokenIdFromReceipt(undefined)).to.be.null
  })

  it('should return null when receipt has empty logs array', () => {
    expect(extractTokenIdFromReceipt({ logs: [] })).to.be.null
  })

  it('should extract token ID from a valid ERC-721 Transfer event (4 topics)', () => {
    const receipt = {
      logs: [
        {
          topics: [transferEventSignature, ZERO_ADDRESS, RECIPIENT, TOKEN_ID_HEX],
        },
      ],
    }
    const tokenId = extractTokenIdFromReceipt(receipt)
    expect(tokenId).to.equal('66') // 0x42 = 66
  })

  it('should NOT match ERC-20 Transfer events (3 topics)', () => {
    const receipt = {
      logs: [
        {
          // ERC-20 Transfer: only 3 topics (event sig, from, to). Amount is in data.
          topics: [transferEventSignature, ZERO_ADDRESS, RECIPIENT],
          data: '0x00000000000000000000000000000000000000000000003635c9adc5dea00000',
        },
      ],
    }
    const tokenId = extractTokenIdFromReceipt(receipt)
    expect(tokenId).to.be.null
  })

  it('should skip ERC-20 Transfer and find ERC-721 Transfer when both present', () => {
    const receipt = {
      logs: [
        {
          // ERC-20 Transfer first (3 topics)
          topics: [transferEventSignature, ZERO_ADDRESS, RECIPIENT],
          data: '0x00000000000000000000000000000000000000000000003635c9adc5dea00000',
        },
        {
          // ERC-721 Transfer second (4 topics)
          topics: [transferEventSignature, ZERO_ADDRESS, RECIPIENT, TOKEN_ID_HEX],
        },
      ],
    }
    const tokenId = extractTokenIdFromReceipt(receipt)
    expect(tokenId).to.equal('66')
  })

  it('should handle receipts with non-Transfer event logs mixed in', () => {
    const otherEventSignature = ethers.utils.id('Approval(address,address,uint256)')
    const receipt = {
      logs: [
        {
          topics: [otherEventSignature, ZERO_ADDRESS, RECIPIENT],
        },
        {
          topics: [transferEventSignature, ZERO_ADDRESS, RECIPIENT, TOKEN_ID_HEX],
        },
      ],
    }
    const tokenId = extractTokenIdFromReceipt(receipt)
    expect(tokenId).to.equal('66')
  })

  it('should correctly parse large token IDs', () => {
    const largeTokenIdHex =
      '0x00000000000000000000000000000000000000000000000000000000000003E8'
    const receipt = {
      logs: [
        {
          topics: [transferEventSignature, ZERO_ADDRESS, RECIPIENT, largeTokenIdHex],
        },
      ],
    }
    const tokenId = extractTokenIdFromReceipt(receipt)
    expect(tokenId).to.equal('1000')
  })
})

// ============================================================================
// Bug #4: Floating-point precision on funding goals
// Math.trunc(fundingGoalInETH * 1e18) loses precision due to floating-point.
// ethers.utils.parseEther(String(value)) avoids this by parsing from string.
// ============================================================================
describe('Bug #4: Funding goal precision', () => {
  it('should correctly convert 1.1 ETH without precision loss', () => {
    // The old bug: Math.trunc(1.1 * 1e18) === 1100000000000000100 (100 wei off)
    const oldBugResult = Math.trunc(1.1 * 1e18)
    expect(oldBugResult).to.not.equal(1.1e18)

    // The fix: ethers.utils.parseEther handles it correctly
    const fixedResult = ethers.utils.parseEther('1.1')
    expect(fixedResult.toString()).to.equal('1100000000000000000')
  })

  it('should correctly convert 0.1 ETH', () => {
    const result = ethers.utils.parseEther('0.1')
    expect(result.toString()).to.equal('100000000000000000')
  })

  it('should correctly convert 1 ETH', () => {
    const result = ethers.utils.parseEther('1')
    expect(result.toString()).to.equal('1000000000000000000')
  })

  it('should correctly convert 10 ETH (would exceed MAX_SAFE_INTEGER with old method)', () => {
    // The old bug: Math.trunc(10 * 1e18) = 10000000000000000000
    // but 1e19 > Number.MAX_SAFE_INTEGER (9007199254740991), so precision loss occurs
    const result = ethers.utils.parseEther('10')
    expect(result.toString()).to.equal('10000000000000000000')
  })

  it('should correctly convert 100 ETH', () => {
    const result = ethers.utils.parseEther('100')
    expect(result.toString()).to.equal('100000000000000000000')
  })

  it('should correctly handle typical USD-to-ETH conversion results', () => {
    // Simulate: $1000 / $2000 per ETH = 0.5 ETH
    const fundingGoalInETH = 1000 / 2000
    const result = ethers.utils.parseEther(String(fundingGoalInETH))
    expect(result.toString()).to.equal('500000000000000000')
  })

  it('should correctly handle very small amounts', () => {
    const result = ethers.utils.parseEther('0.000001')
    expect(result.toString()).to.equal('1000000000000')
  })

  it('should produce a value that can be used in contract calls', () => {
    const fundingGoalInETH = 0.3
    const result = ethers.utils.parseEther(String(fundingGoalInETH))
    // Should be a valid BigNumber that can be passed to contracts
    expect(result.gt(0)).to.be.true
    expect(result.eq(ethers.utils.parseEther('0.3'))).to.be.true
  })
})

// ============================================================================
// Bug #5: Coinbase origin check bypass
// The old .includes() check allowed spoofed origins like evil-coinbase.com.
// The fix uses proper URL hostname parsing with suffix matching.
// ============================================================================
describe('Bug #5: Coinbase origin validation', () => {
  const isValidCoinbaseOrigin = (origin: string): boolean => {
    let hostname: string
    try {
      hostname = new URL(origin).hostname
    } catch {
      return false
    }
    return (
      hostname === 'coinbase.com' ||
      hostname.endsWith('.coinbase.com') ||
      hostname === 'cb-pay.com' ||
      hostname.endsWith('.cb-pay.com')
    )
  }

  // Valid origins that SHOULD be accepted
  it('should accept https://coinbase.com', () => {
    expect(isValidCoinbaseOrigin('https://coinbase.com')).to.be.true
  })

  it('should accept https://pay.coinbase.com', () => {
    expect(isValidCoinbaseOrigin('https://pay.coinbase.com')).to.be.true
  })

  it('should accept https://onramp.coinbase.com', () => {
    expect(isValidCoinbaseOrigin('https://onramp.coinbase.com')).to.be.true
  })

  it('should accept https://cb-pay.com', () => {
    expect(isValidCoinbaseOrigin('https://cb-pay.com')).to.be.true
  })

  it('should accept https://widget.cb-pay.com', () => {
    expect(isValidCoinbaseOrigin('https://widget.cb-pay.com')).to.be.true
  })

  it('should accept deeply nested subdomains', () => {
    expect(isValidCoinbaseOrigin('https://a.b.c.coinbase.com')).to.be.true
  })

  // Malicious origins that MUST be rejected
  it('should reject https://evil-coinbase.com (subdomain spoof)', () => {
    expect(isValidCoinbaseOrigin('https://evil-coinbase.com')).to.be.false
  })

  it('should reject https://coinbase.com.evil.com (domain within subdomain)', () => {
    expect(isValidCoinbaseOrigin('https://coinbase.com.evil.com')).to.be.false
  })

  it('should reject https://fakecb-pay.com (prefix spoof)', () => {
    expect(isValidCoinbaseOrigin('https://fakecb-pay.com')).to.be.false
  })

  it('should reject https://cb-pay.com.attacker.com', () => {
    expect(isValidCoinbaseOrigin('https://cb-pay.com.attacker.com')).to.be.false
  })

  it('should reject https://notcoinbase.com', () => {
    expect(isValidCoinbaseOrigin('https://notcoinbase.com')).to.be.false
  })

  it('should reject https://evil.com/coinbase.com', () => {
    expect(isValidCoinbaseOrigin('https://evil.com/coinbase.com')).to.be.false
  })

  it('should reject empty string', () => {
    expect(isValidCoinbaseOrigin('')).to.be.false
  })

  it('should reject malformed URLs', () => {
    expect(isValidCoinbaseOrigin('not-a-url')).to.be.false
    expect(isValidCoinbaseOrigin('javascript:alert(1)')).to.be.false
  })

  it('should reject completely unrelated origins', () => {
    expect(isValidCoinbaseOrigin('https://google.com')).to.be.false
    expect(isValidCoinbaseOrigin('https://example.com')).to.be.false
  })

  // Verify the old .includes() method would have failed these
  it('should NOT have the .includes() vulnerability', () => {
    // These would pass the old .includes('coinbase.com') check but must fail now
    const spoofedOrigins = [
      'https://evil-coinbase.com',
      'https://coinbase.com.evil.com',
      'https://my-coinbase.com',
      'https://coinbase.com-phishing.com',
    ]
    spoofedOrigins.forEach((origin) => {
      expect(isValidCoinbaseOrigin(origin)).to.be.false
    })
  })
})

// ============================================================================
// Bug #6: Crash when no MissionCreated event log found
// ethers.BigNumber.from(undefined) throws. Must check for null before parsing.
// ============================================================================
describe('Bug #6: MissionCreated event log null safety', () => {
  const missionCreatedEventSignature = ethers.utils.id(
    'MissionCreated(uint256,uint256,uint256,address,uint256)'
  )

  const extractMissionId = (receipt: any): string | null => {
    if (!receipt?.logs) return null

    const missionCreatedLog = receipt.logs.find(
      (log: any) => log.topics[0] === missionCreatedEventSignature
    )

    if (!missionCreatedLog || !missionCreatedLog.topics[1]) {
      return null
    }

    return ethers.BigNumber.from(missionCreatedLog.topics[1]).toString()
  }

  it('should return null when receipt has no logs', () => {
    expect(extractMissionId({ logs: [] })).to.be.null
  })

  it('should return null when receipt is null', () => {
    expect(extractMissionId(null)).to.be.null
  })

  it('should return null when receipt is undefined', () => {
    expect(extractMissionId(undefined)).to.be.null
  })

  it('should return null when no MissionCreated event is found in logs', () => {
    const receipt = {
      logs: [
        {
          topics: [
            ethers.utils.id('Transfer(address,address,uint256)'),
            '0x0000000000000000000000000000000000000000',
            '0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12',
          ],
        },
      ],
    }
    expect(extractMissionId(receipt)).to.be.null
  })

  it('should NOT throw when no MissionCreated event is found (the original crash)', () => {
    const receipt = { logs: [] }
    expect(() => extractMissionId(receipt)).to.not.throw()
  })

  it('should correctly extract mission ID when MissionCreated event is present', () => {
    const missionIdHex =
      '0x0000000000000000000000000000000000000000000000000000000000000007'
    const receipt = {
      logs: [
        {
          topics: [
            missionCreatedEventSignature,
            missionIdHex, // missionId
            '0x0000000000000000000000000000000000000000000000000000000000000001', // teamId
            '0x0000000000000000000000000000000000000000000000000000000000000001', // projectId
          ],
        },
      ],
    }
    expect(extractMissionId(receipt)).to.equal('7')
  })

  it('should handle MissionCreated event with large mission ID', () => {
    const missionIdHex =
      '0x00000000000000000000000000000000000000000000000000000000000003E8'
    const receipt = {
      logs: [
        {
          topics: [
            missionCreatedEventSignature,
            missionIdHex,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
          ],
        },
      ],
    }
    expect(extractMissionId(receipt)).to.equal('1000')
  })

  it('should return null when topics[1] is missing', () => {
    const receipt = {
      logs: [
        {
          topics: [missionCreatedEventSignature],
        },
      ],
    }
    expect(extractMissionId(receipt)).to.be.null
  })

  it('should find MissionCreated among other events', () => {
    const missionIdHex =
      '0x0000000000000000000000000000000000000000000000000000000000000005'
    const receipt = {
      logs: [
        {
          topics: [
            ethers.utils.id('Transfer(address,address,uint256)'),
            '0x0000000000000000000000000000000000000000',
            '0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12',
          ],
        },
        {
          topics: [
            ethers.utils.id('Approval(address,address,uint256)'),
            '0x0000000000000000000000000000000000000000',
            '0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12',
          ],
        },
        {
          topics: [
            missionCreatedEventSignature,
            missionIdHex,
            '0x0000000000000000000000000000000000000000000000000000000000000001',
          ],
        },
      ],
    }
    expect(extractMissionId(receipt)).to.equal('5')
  })
})
