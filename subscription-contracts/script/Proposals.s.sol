pragma solidity ^0.8.20;

import "../src/tables/Proposals.sol";
import "base/Config.sol";

contract MyScript is Script, Config {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Senators senators = new Senators();
        if (block.chainid == SEP){
            address[] memory newSenators = new address[](3);
            newSenators[0] = 0x08B3e694caA2F1fcF8eF71095CED1326f3454B89;
            newSenators[1] = 0x80581C6e88Ce00095F85cdf24bB760f16d6eC0D6;
            newSenators[2] = 0x679d87D8640e66778c3419D164998E720D7495f6;
            senators.addSenators(newSenators);
            Proposals votes = new Proposals("Proposals", address(senators), 1, 1);
        } else {
            address[] memory newSenators = new address[](10);
            newSenators[0] = 0xf2Befa4B9489c1ef75E069D16A6F829F71B4B988; // frank
            newSenators[1] = 0x8687AB2FF3188F961828FC2131b6150Ee97Bedce; // kara
            newSenators[2] = 0x00127F44BaD82B9ea27245A14a4141e5Ef0161A8; // roy
            newSenators[3] = 0xB87b8c495d3DAE468d4351621b69d2eC10E656FE; // alex
            newSenators[4] = 0x4CBf10c36b481d6afF063070E35b4F42E7Aad201; // engibob
            newSenators[5] = 0x529Bd2351476ba114f9D60E71A020A9F0b99f047; // anastasia
            newSenators[6] = 0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801; // eiman
            newSenators[7] = 0x8A7fD7F4B1A77A606DFdD229c194B1F22De868Ff; // daniel
            newSenators[8] = 0x86c779b3741e83A36A2a236780d436E4EC673Af4; // titan
            newSenators[9] = 0x08B3e694caA2F1fcF8eF71095CED1326f3454B89; // jade
            // FIXME are these the right senators/quorum/threshold?
            senators.addSenators(newSenators);
            uint256 quorum = 6;
            uint256 threshold = 6;
            Proposals votes = new Proposals("Proposals", address(senators), quorum, threshold);
        }
        vm.stopBroadcast();
    }
}

