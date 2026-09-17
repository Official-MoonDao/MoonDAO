// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/Forecasts.sol";

contract ForecastsScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Forecasts forecasts = new Forecasts("Forecasts");
        address writer = vm.envOr("FORECASTS_WRITER", address(0));
        if (writer != address(0)) {
            forecasts.setWriter(writer, true);
        }

        vm.stopBroadcast();
    }
}
