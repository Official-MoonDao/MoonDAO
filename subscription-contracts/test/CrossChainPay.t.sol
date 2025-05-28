// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/console.sol";
import "forge-std/Test.sol";
import "../src/CrossChainPay.sol";
import "@layerzerolabs/test-devtools-evm-foundry/contracts/mocks/EndpointV2Mock.sol";
import { TestHelperOz5 } from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";



/// @dev Simple mock to capture pay() calls
contract JBMultiTerminalMock is IJBMultiTerminal {
    uint256 public lastProjectId;
    address public lastToken;
    uint256 public lastAmount;
    address public lastBeneficiary;
    uint256 public lastMinReturned;
    string  public lastMemo;
    bytes   public lastMetadata;

    event PayCalled(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string memo,
        bytes metadata
    );

    function pay(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata metadata
    )
        external
        payable
        override
        returns (uint256 beneficiaryTokenCount)
    {
        // store for assertion
        lastProjectId    = projectId;
        lastToken        = token;
        lastAmount       = amount;
        lastBeneficiary  = beneficiary;
        lastMinReturned  = minReturnedTokens;
        lastMemo         = memo;
        lastMetadata     = metadata;

        emit PayCalled(projectId, token, amount, beneficiary, minReturnedTokens, memo, metadata);
        return amount;
    }
}

contract CrossChainPayTest is Test, TestHelperOz5 {
    EndpointV2Mock    endpointA;
    EndpointV2Mock    endpointB;
    CrossChainPay     oappA;
    CrossChainPay     oappB;
    JBMultiTerminalMock jbMock;

    uint16 constant   EID_A = 1;
    uint16 constant   EID_B = 2;

    address constant  OWNER = address(0x3);
    address constant  USER  = address(0xBEEF);

    function setUp() public virtual override {
        // 1) deploy two endpoints
        super.setUp();

        setUpEndpoints(2, LibraryType.UltraLightNode);


        endpointA = new EndpointV2Mock(EID_A, address(this));
        endpointB = new EndpointV2Mock(EID_B, address(this));

        // 2) deploy a single JBMultiTerminalMock to be used by both
        jbMock = new JBMultiTerminalMock();

        // 3) deploy our two OApps
        oappA = new CrossChainPay(address(this), address(endpointA), address(jbMock));
        oappB = new CrossChainPay(address(this), address(endpointB), address(jbMock));


        oappA = CrossChainPay(
            _deployOApp(type(CrossChainPay).creationCode, abi.encode(address(this), address(endpoints[EID_A]), address(jbMock)))
        );
        oappB = CrossChainPay(
            _deployOApp(type(CrossChainPay).creationCode, abi.encode(address(this), address(endpoints[EID_B]), address(jbMock)))
        );

        address[] memory ofts = new address[](2);
        ofts[0] = address(oappA);
        ofts[1] = address(oappB);

        this.wireOApps(ofts);


        // 4) wire the endpoints to each other
        //endpointA.setDestLzEndpoint(address(oappB), address(endpointB));
        //endpointB.setDestLzEndpoint(address(oappA), address(endpointA));

        //console.log("this", address(this));
        //// 5) whitelist each OApp as a peer
        //oappA.setPeer(EID_B, bytes32(uint256(uint160(address(oappB)))));
        //oappB.setPeer(EID_A, bytes32(uint256(uint160(address(oappA)))));
    }

    function testCrossChainPayFlowsThrough() public {
        // give USER some ETH
        vm.deal(USER, 10 ether);

        // arbitrary params
        uint256 projectId       = 42;
        address token           = address(0x1234);
        uint256 amount          = 2 ether;
        address beneficiary     = address(0xCAFE);
        uint256 minReturned     = 0;
        string memory memo      = "";
        bytes memory metadata   = hex"";
        bytes memory options = OptionsBuilder.newOptions();
        bytes memory options_  = OptionsBuilder.addExecutorLzReceiveOption(options, 200000, 0.1 ether);


        // USER calls crossChainPay on A
        vm.prank(USER);
        oappA.crossChainPay{ value: amount }(
            EID_B,
            options_,
            projectId,
            token,
            amount,
            beneficiary,
            minReturned,
            memo,
            metadata
        );

        // because _lzSend → EndpointV2Mock.send → oappB._lzReceive happens synchronously,
        // our mock's pay() has already fired. Let's check it:
        //assertEq(jbMock.lastProjectId(),   projectId,   "projectId");
        //assertEq(jbMock.lastToken(),       token,       "token");
        assertEq(jbMock.lastAmount(),      amount,      "amount");
        //assertEq(jbMock.lastBeneficiary(), beneficiary, "beneficiary");
        //assertEq(jbMock.lastMinReturned(), minReturned, "minReturned");
        //assertEq(jbMock.lastMemo(),        memo,        "memo");
        //assertEq(jbMock.lastMetadata(),    metadata,    "metadata");
    }
}
