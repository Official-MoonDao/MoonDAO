// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Project} from "../src/tables/Project.sol";
import {ProjectTeamCreator} from "../src/ProjectTeamCreator.sol";
import {IHats} from "@hats/Interfaces/IHats.sol";
import {ProjectTeam} from "../src/ProjectTeam.sol";



contract MyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);


        address hatsAddress = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
        address hatsModuleFactoryAddress = 0x0a3f85fa597B6a967271286aA0724811acDF5CD9;
        address hatsPassthroughAddress = 0x97b5621E4CD8F403ab5b6036181982752DE3aC44;
        address gnosisSingletonAddress = 0x3E5c63644E683549055b9Be8653de26E0B4CD36E;
        address gnosisSafeProxyFactoryAddress = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2;

        IHats hats = IHats(hatsAddress);


        address oldCreatorAddress = 0xe5709Bc44427DCEF81fF2F718DFc6A032fD23bbF;
        //uint256 projectTeamAdminHatId = 1887196678076684115928201594833669786492226355261806482072218554597376;
        //uint256 projectTeamAdminHatId = 0x0000018200020000000000000000000000000000000000000000000000000000;

        address projectAddress = 0xCb31829B312923C7502766ef4f36948A7A64cD6A;
        address projectTableAddress = 0x83755AF34867a3513ddCE921E9cAd28f0828CDdB;
        if (block.chainid == 11155111){
            projectTableAddress = 0x885ab2ADe7f3223490d970f01558CD9251df85cd;
            projectAddress = 0xb13540430A4D63D3A8741b6D898CA15011ac17BF;
            oldCreatorAddress = 0xd1EfE13758b73F2Db9Ed19921eB756fbe4C26E2D;
        }
        ProjectTeam projectTeam = ProjectTeam(projectAddress);


        ProjectTeamCreator creator = new ProjectTeamCreator(hatsAddress, hatsModuleFactoryAddress, hatsPassthroughAddress, address(projectTeam), gnosisSingletonAddress, gnosisSafeProxyFactoryAddress, projectTableAddress);

        creator.setProjectTeamAdminHatId(projectTeamAdminHatId);
        projectTeam.setProjectTeamCreator(address(creator));

        hats.transferHat(projectTeamAdminHatId, oldCreatorAddress, address(creator));
        //hats.mintHat(projectTeamAdminHatId, address(creator));
        //hats.changeHatEligibility(projectTeamAdminHatId, address(creator));


        vm.stopBroadcast();
    }
}
