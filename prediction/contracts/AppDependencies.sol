pragma solidity ^0.5.1;

// NOTE: This file's purpose is to make Truffle compile the unmodified Gnosis
// dependencies DePrize deploys. There is no MoonDAO market-maker subclass in v2:
// markets are stock `LMSRMarketMaker` clones from the stock factory.

import '@gnosis.pm/conditional-tokens-market-makers/contracts/LMSRMarketMaker.sol';
import '@gnosis.pm/conditional-tokens-market-makers/contracts/LMSRMarketMakerFactory.sol';
import 'canonical-weth/contracts/WETH9.sol';

contract AppDependencies {
}
