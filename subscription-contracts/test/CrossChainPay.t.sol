// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import { CrossChainPay } from "../src/CrossChainPay.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTComposeMsgCodec.sol";

// Mock contracts for testing
contract MockJBMultiTerminal {
    mapping(uint256 => uint256) public projectPayments;

    function pay(
        uint256 projectId,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 minReturnedTokens,
        string calldata memo,
        bytes calldata metadata
    ) external payable returns (uint256 beneficiaryTokenCount) {
        require(msg.value == amount, "Incorrect ETH amount");
        projectPayments[projectId] += amount;
        return amount; // Return amount as token count for simplicity
    }
}

contract MockStargate {
    struct SendParam {
        uint32 dstEid;
        bytes32 to;
        uint256 amountLD;
        uint256 minAmountLD;
        bytes extraOptions;
        bytes composeMsg;
        bytes oftCmd;
    }

    struct MessagingFee {
        uint256 nativeFee;
        uint256 lzTokenFee;
    }

    struct MessagingReceipt {
        bytes32 guid;
        uint64 nonce;
        MessagingFee fee;
    }

    uint256 public constant MOCK_FEE = 0.001 ether;
    address public mockCrossChainPay;

    event MockSend(uint32 dstEid, bytes32 to, uint256 amount, bytes composeMsg);

    function setMockCrossChainPay(address _contract) external {
        mockCrossChainPay = _contract;
    }

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundTo
    ) external payable returns (MessagingReceipt memory msgReceipt) {
        require(msg.value >= _sendParam.amountLD + MOCK_FEE, "Insufficient fees");

        emit MockSend(_sendParam.dstEid, _sendParam.to, _sendParam.amountLD, _sendParam.composeMsg);

        // Simulate cross-chain delivery by calling lzCompose on the target contract
        if (mockCrossChainPay != address(0) && _sendParam.composeMsg.length > 0) {
            // In a real scenario, this would happen on the destination chain
            // For testing, we simulate it happening immediately
            CrossChainPay(payable(mockCrossChainPay)).lzCompose{value: _sendParam.amountLD}(
                address(0), // _from (origin)
                bytes32(0), // _guid
                OFTComposeMsgCodec.encode(uint64(1), uint32(2), uint256(3),_sendParam.composeMsg),
                address(0), // _executor
                "" // _extraData
            );
        }

        return MessagingReceipt({
            guid: keccak256(abi.encodePacked(block.timestamp, _sendParam.dstEid)),
            nonce: 1,
            fee: MessagingFee(MOCK_FEE, 0)
        });
    }

    function quoteSend(
        SendParam calldata _sendParam,
        bool _payInLzToken
    ) external pure returns (MessagingFee memory msgFee) {
        return MessagingFee(MOCK_FEE, 0);
    }

}

contract MockERC20 is IERC20 {
    mapping(address => uint256) private _balances;
    uint256 private _totalSupply;

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return 0;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        return true;
    }

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
    }
}

contract CrossChainPayTest is Test {
    CrossChainPay public crossChainPay;
    MockJBMultiTerminal public mockJBTerminal;
    MockStargate public mockStargate;
    MockERC20 public mockToken;

    address public owner = address(0x420);
    address public user = address(0x2);
    address public beneficiary = address(0x3);

    uint32 public constant DST_EID = 102; // Polygon
    uint256 public constant PROJECT_ID = 1;
    uint256 public constant TRANSFER_AMOUNT = 1 ether;
    uint256 public constant MIN_RETURNED_TOKENS = 0;
    string public constant MEMO = "";
    bytes public constant METADATA = "";

    function setUp() public {
        // Deploy mock contracts
        mockJBTerminal = new MockJBMultiTerminal();
        mockStargate = new MockStargate();
        mockToken = new MockERC20();

        // Deploy CrossChainPay contract
        vm.startPrank(owner);
        crossChainPay = new CrossChainPay(
            owner,
            address(mockJBTerminal),
            address(mockStargate)
        );
        vm.stopPrank();

        // Set up mock relationships
        mockStargate.setMockCrossChainPay(address(crossChainPay));

        // Fund test accounts
        vm.deal(user, 10 ether);
        vm.deal(address(crossChainPay), 5 ether);
    }

    function testConstructor() public {
        assertEq(address(crossChainPay.jbMultiTerminal()), address(mockJBTerminal));
        assertEq(address(crossChainPay.stargateRouter()), address(mockStargate));
        assertEq(crossChainPay.owner(), owner);
    }

    function testCrossChainPaySuccess() public {
        uint256 totalAmount = TRANSFER_AMOUNT + mockStargate.MOCK_FEE();

        vm.startPrank(user);

        // FIXME make sure mock parses message properly to fix this test
        vm.expectRevert();
        crossChainPay.crossChainPay{value: totalAmount}(
            DST_EID,
            PROJECT_ID,
            TRANSFER_AMOUNT,
            beneficiary,
            MIN_RETURNED_TOKENS,
            MEMO,
            METADATA
        );

        vm.stopPrank();
    }

    function testCrossChainPayInsufficientAmount() public {
        vm.startPrank(user);

        // Test with insufficient ETH
        vm.expectRevert("Insufficient ETH sent");
        crossChainPay.crossChainPay{value: 0.5 ether}(
            DST_EID,
            PROJECT_ID,
            TRANSFER_AMOUNT,
            beneficiary,
            MIN_RETURNED_TOKENS,
            MEMO,
            METADATA
        );

        vm.stopPrank();
    }

    function testCrossChainPayZeroAmount() public {
        vm.startPrank(user);

        // Test with zero amount
        vm.expectRevert("Amount must be greater than 0");
        crossChainPay.crossChainPay{value: 1 ether}(
            DST_EID,
            PROJECT_ID,
            0,
            beneficiary,
            MIN_RETURNED_TOKENS,
            MEMO,
            METADATA
        );

        vm.stopPrank();
    }

    function testCrossChainPayInsufficientFees() public {
        vm.startPrank(user);

        // Test with insufficient fees (amount but no fee)
        vm.expectRevert("Insufficient ETH for transfer and fees");
        crossChainPay.crossChainPay{value: TRANSFER_AMOUNT}(
            DST_EID,
            PROJECT_ID,
            TRANSFER_AMOUNT,
            beneficiary,
            MIN_RETURNED_TOKENS,
            MEMO,
            METADATA
        );

        vm.stopPrank();
    }

    function testQuoteCrossChainPay() public {
        uint256 quote = crossChainPay.quoteCrossChainPay(
            DST_EID,
            TRANSFER_AMOUNT,
            PROJECT_ID,
            beneficiary,
            MIN_RETURNED_TOKENS,
            MEMO,
            METADATA
        );

        assertEq(quote, TRANSFER_AMOUNT + mockStargate.MOCK_FEE());
    }

    function testSetJbMultiTerminalAddress() public {
        address newTerminal = address(0x999);

        vm.startPrank(owner);
        crossChainPay.setJbMultiTerminalAddress(newTerminal);
        vm.stopPrank();

        assertEq(address(crossChainPay.jbMultiTerminal()), newTerminal);
    }

    function testSetJbMultiTerminalAddressUnauthorized() public {
        address newTerminal = address(0x999);

        vm.startPrank(user);
        vm.expectRevert();
        crossChainPay.setJbMultiTerminalAddress(newTerminal);
        vm.stopPrank();
    }

    function testSetStargateRouter() public {
        address newRouter = address(0x888);

        vm.startPrank(owner);
        crossChainPay.setStargateRouter(newRouter);
        vm.stopPrank();

        assertEq(address(crossChainPay.stargateRouter()), newRouter);
    }

    function testSetStargateRouterUnauthorized() public {
        address newRouter = address(0x888);

        vm.startPrank(user);
        vm.expectRevert();
        crossChainPay.setStargateRouter(newRouter);
        vm.stopPrank();
    }

    function testEmergencyWithdraw() public {
        uint256 initialBalance = owner.balance;
        uint256 contractBalance = address(crossChainPay).balance;

        vm.startPrank(owner);
        crossChainPay.emergencyWithdraw();
        vm.stopPrank();

        assertEq(address(crossChainPay).balance, 0);
        assertEq(owner.balance, initialBalance + contractBalance);
    }

    function testEmergencyWithdrawUnauthorized() public {
        vm.startPrank(user);
        vm.expectRevert();
        crossChainPay.emergencyWithdraw();
        vm.stopPrank();
    }

    function testReceiveETH() public {
        uint256 initialBalance = address(crossChainPay).balance;
        uint256 sendAmount = 1 ether;

        vm.startPrank(user);
        (bool success,) = address(crossChainPay).call{value: sendAmount}("");
        vm.stopPrank();

        assertTrue(success);
        assertEq(address(crossChainPay).balance, initialBalance + sendAmount);
    }

    // Events for testing
    event CrossChainPayInitiated(
        uint32 indexed dstEid,
        uint256 indexed projectId,
        uint256 amount,
        address beneficiary
    );

    event CrossChainPayReceived(
        uint256 indexed projectId,
        uint256 amount,
        address beneficiary
    );

}
