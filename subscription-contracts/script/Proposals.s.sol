pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/tables/Proposals.sol";

contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Senators senators = new Senators();
        address[] memory newSenators = new address[](3);
        newSenators[0] = 0x08B3e694caA2F1fcF8eF71095CED1326f3454B89;
        newSenators[1] = 0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6;
        newSenators[2] = 0x679d87D8640e66778c3419D164998E720D7495f6;
        senators.addSenators(newSenators);
        Proposals votes = new Proposals("Proposals", address(senators), 2, 2);
        vm.stopBroadcast();
    }
}

