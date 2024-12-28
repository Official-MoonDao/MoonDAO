// SPDX-License-Identifier: MIT
//pragma solidity ^0.8.0;

import '@gnosis.pm/conditional-tokens-market-makers/contracts/LMSRMarketMaker.sol';


contract LMSRWithTWAP is LMSRMarketMaker {
    uint256 public startTime;
    // Cumulative probabilities over time: sum(prob[i](t) * dt) from startTime to now.
    uint256[] public cumulativeProbabilities;
    uint256 public lastUpdateTime;

    constructor() public {
        uint256 outcomes = this.atomicOutcomeSlotCount();
        cumulativeProbabilities = new uint256[](outcomes);
        startTime = block.timestamp;
        lastUpdateTime = block.timestamp;
    }

    /**
     * @notice Updates the cumulativeProbabilities based on elapsed time and current probabilities.
     */
    function updateCumulativeTWAP() public {
        uint256 elapsed = block.timestamp - lastUpdateTime;
        if (elapsed == 0) {
            return;
        }

        // Get current outcome probabilities from the LMSR.
        uint256 length = cumulativeProbabilities.length;

        // Accumulate probabilities * time
        for (uint8 i = 0; i < length; i++) {
            // Assuming calcMarginalPrice returns a normalized probability in [0, 1] scaled to 1e18 (for example).
            // If not normalized, you might need to normalize them first.
            // For now, assume they sum to 1e18 and represent probabilities as fixed-point numbers.
            uint256 currentPrice = this.calcMarginalPrice(i);
            if (currentPrice == 0) {
                continue;
            }
            cumulativeProbabilities[i] += currentPrice * elapsed;
        }

        lastUpdateTime = block.timestamp;
    }

    /**
     * @notice Trades on the LMSR and updates TWAP before doing so.
     * @param outcomeTokenAmounts The outcome to buy/sell.
     * @param collateralLimit The amount to buy (positive) or sell (negative).
     */
    function tradeWithTWAP(int[] memory outcomeTokenAmounts, int collateralLimit) public {
        // Update TWAP before trade.
        updateCumulativeTWAP();
        require(outcomeTokenAmounts.length == cumulativeProbabilities.length, "Mismatched array lengths");


        // Perform the trade on the LMSR using delegated call.
        // Note: Make sure the caller has given allowances for collateral tokens or handle that logic externally.
        this.trade(outcomeTokenAmounts, collateralLimit);
        //bytes memory payload = abi.encodeWithSignature("trade(int256[],int256)", outcomeTokenAmounts, collateralLimit);
        //(bool success, ) = address(marketMaker).call(payload);
        //require(success, "Trade execution failed");

    }

    /**
     * @notice Returns the current TWAP probabilities over the entire period from startTime to now.
     * This is cumulativeProb / totalElapsedTime.
     * @dev If needed, you can call updateCumulativeTWAP() first to get fresh values.
     */
    function getTWAP() external view returns (uint256[] memory) {
        uint256 totalTime = block.timestamp - startTime;
        if (totalTime == 0) {
            return cumulativeProbabilities;
        }
        uint256 length = cumulativeProbabilities.length;
        uint256[] memory twap = new uint256[](length);

        // To get the freshest TWAP, you'd need to incorporate the current probabilities
        // since lastUpdateTime. For a read-only approximation, let's just return what is stored.
        // If you want exact up-to-the-second TWAP, you'd replicate the logic in updateCumulativeTWAP()
        // off-chain or implement a view function that simulates it.
        //uint256[] memory currentPrices = marketMaker.calcMarginalPrice();
        uint256 elapsed = block.timestamp - lastUpdateTime;

        for (uint8 i = 0; i < length; i++) {
            uint256 currentPrice = this.calcMarginalPrice(i);
            uint256 adjustedCumulative = cumulativeProbabilities[i] + currentPrice * elapsed;
            twap[i] = adjustedCumulative / totalTime;
        }
        return twap;
    }
}
