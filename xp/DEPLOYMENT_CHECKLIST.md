# XP System Deployment Checklist

## Pre-Deployment

- [ ] **Environment Setup**
  - [ ] Create `.env` file with required variables
  - [ ] Set `PRIVATE_KEY` for deployment
  - [ ] Set `REWARD_TOKEN_ADDRESS` (existing token)
  - [ ] Set `CITIZEN_NFT_ADDRESS` (existing MoonDAO Citizen NFT)
  - [ ] Verify RPC endpoint is working

- [ ] **Dependencies**
  - [ ] Install Foundry: `curl -L https://foundry.paradigm.xyz | bash`
  - [ ] Install dependencies: `forge install`
  - [ ] Verify all imports resolve correctly

- [ ] **Testing**
  - [ ] Run tests: `forge test`
  - [ ] Verify all tests pass
  - [ ] Check test coverage

## Deployment Steps

### Step 1: Deploy XPManager
```bash
forge create XPManager --constructor-args <REWARD_TOKEN_ADDRESS>
```
- [ ] Save XPManager address
- [ ] Verify constructor parameters

### Step 2: Deploy OwnsCitizenNFT Verifier
```bash
forge create OwnsCitizenNFT
```
- [ ] Save verifier address
- [ ] Verify deployment

### Step 3: Register Verifier
```bash
cast call <XP_MANAGER_ADDRESS> "registerVerifier(uint256,address)" 1 <VERIFIER_ADDRESS>
```
- [ ] Verify registration
- [ ] Check `verifiers(1)` returns correct address

### Step 4: Fund XPManager
```bash
cast call <REWARD_TOKEN_ADDRESS> "transfer(address,uint256)" <XP_MANAGER_ADDRESS> <AMOUNT>
```
- [ ] Transfer sufficient reward tokens to XPManager
- [ ] Verify balance

## Post-Deployment Verification

### Contract Verification
- [ ] **XPManager**
  - [ ] Check `rewardToken()` returns correct address
  - [ ] Check `xpPerReward()` returns 1000
  - [ ] Verify `verifiers(1)` returns verifier address

- [ ] **OwnsCitizenNFT**
  - [ ] Check `name()` returns "OwnsCitizenNFT:v1"
  - [ ] Test `isEligible()` with valid user
  - [ ] Test `claimId()` generates unique IDs

### Integration Testing
- [ ] **User Flow Test**
  - [ ] User with Citizen NFT can claim XP
  - [ ] User without Citizen NFT cannot claim
  - [ ] Double-claiming is prevented
  - [ ] XP accumulation works correctly
  - [ ] Reward token distribution works

- [ ] **Edge Cases**
  - [ ] Invalid condition ID
  - [ ] Invalid context data
  - [ ] Zero XP amount
  - [ ] Unregistered verifier

## Configuration

### XPManager Settings
- [ ] **xpPerReward**: Default 1000 (adjust if needed)
- [ ] **rewardToken**: Verify correct token address
- [ ] **Verifier Registration**: All verifiers properly registered

### Verifier Context Format
- [ ] **OwnsCitizenNFT**: `abi.encode(address citizenNFTAddress, uint256 xpAmount)`
- [ ] Document context format for future verifiers

## Security Review

- [ ] **Access Control**
  - [ ] `registerVerifier` has proper access control
  - [ ] No unauthorized functions exposed

- [ ] **Token Security**
  - [ ] XPManager has sufficient reward token balance
  - [ ] No token draining vulnerabilities

- [ ] **Verifier Security**
  - [ ] Verifiers are properly validated
  - [ ] Context data is safely decoded

## Documentation

- [ ] **Addresses Recorded**
  - [ ] XPManager address
  - [ ] OwnsCitizenNFT verifier address
  - [ ] Condition ID mappings

- [ ] **Usage Examples**
  - [ ] Frontend integration examples
  - [ ] API documentation
  - [ ] User guides

## Monitoring Setup

- [ ] **Event Monitoring**
  - [ ] XP claim events
  - [ ] Reward distribution events
  - [ ] Error tracking

- [ ] **Analytics**
  - [ ] XP distribution metrics
  - [ ] User engagement tracking
  - [ ] Reward token circulation

## Final Checklist

- [ ] All contracts deployed successfully
- [ ] All tests passing
- [ ] Integration verified
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Team notified of deployment

## Emergency Procedures

- [ ] **Pause Mechanism**: Plan for emergency pausing if needed
- [ ] **Upgrade Path**: Plan for contract upgrades
- [ ] **Contact List**: Key personnel for emergency response

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Network**: _______________
