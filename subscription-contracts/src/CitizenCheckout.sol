// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMoonDAOCitizen {
    function getRenewalPrice(address owner, uint64 duration) external view returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);

    function mintTo(
        address to,
        string calldata name,
        string calldata bio,
        string calldata image,
        string calldata location,
        string calldata discord,
        string calldata twitter,
        string calldata website,
        string calldata _view,
        string calldata formId
    ) external payable returns (uint256);

    function renewSubscription(uint256 tokenId, uint64 duration) external payable;
}

interface IWETH9 {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IVotingEscrow {
    function locked(address addr) external view returns (int128 amount, uint256 end);

    function deposit_for(address addr, uint256 value) external;
}

/// @title CitizenCheckout
/// @notice Charges 4/3 of the citizen renewal price. Three quarters renew the
///         NFT (and are forwarded to the treasury by MoonDAOCitizen). One
///         quarter is swapped for MOONEY on the Arbitrum Uniswap v3 pool and
///         locked when the citizen already has a live vMOONEY allowance.
contract CitizenCheckout is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant ONE_YEAR = 365 days;

    IMoonDAOCitizen public immutable citizen;
    ISwapRouter public immutable swapRouter;
    IWETH9 public immutable weth;
    IERC20 public immutable mooney;
    IVotingEscrow public immutable ve;
    uint24 public immutable poolFee;

    /// @notice May call `mintSponsored` (the gas-sponsor key for free and partial invites).
    address public sponsor;

    bool public paused;

    struct Profile {
        address to;
        string name;
        string bio;
        string image;
        string location;
        string discord;
        string twitter;
        string website;
        string viewData;
        string formId;
    }

    event Stake(address indexed citizen, uint256 mooneyAmount, bool locked);
    event SponsorUpdated(address sponsor);
    event Paused(bool paused);

    error PausedCheckout();
    error PaymentTooLow(uint256 required, uint256 sent);
    error NotSponsor();
    error Slippage();

    constructor(
        address owner_,
        address citizen_,
        address swapRouter_,
        address weth_,
        address mooney_,
        address ve_,
        address sponsor_,
        uint24 poolFee_
    ) Ownable(owner_) {
        require(owner_ != address(0) && citizen_ != address(0), "address");
        require(swapRouter_ != address(0) && weth_ != address(0), "address");
        require(mooney_ != address(0) && ve_ != address(0), "address");
        citizen = IMoonDAOCitizen(citizen_);
        swapRouter = ISwapRouter(swapRouter_);
        weth = IWETH9(weth_);
        mooney = IERC20(mooney_);
        ve = IVotingEscrow(ve_);
        sponsor = sponsor_;
        poolFee = poolFee_;
    }

    /// @notice Treasury share, stake share, and wallet total for `who` over `duration`.
    function quote(address who, uint64 duration) public view returns (uint256 treasury, uint256 stake, uint256 total) {
        treasury = citizen.getRenewalPrice(who, duration);
        if (treasury == 0) return (0, 0, 0);
        total = (treasury * 4) / 3;
        stake = total - treasury;
    }

    function mint(Profile calldata profile, uint256 minMooneyOut) external payable nonReentrant returns (uint256 tokenId) {
        if (paused) revert PausedCheckout();
        (uint256 treasury, , uint256 total) = quote(profile.to, ONE_YEAR);
        if (treasury == 0) {
            tokenId = _mint(profile, 0);
            _refund(msg.sender, msg.value);
            return tokenId;
        }
        if (msg.value < total) revert PaymentTooLow(total, msg.value);
        tokenId = _mint(profile, treasury);
        _buyAndDeliver(profile.to, msg.value - treasury, minMooneyOut);
    }

    function renew(uint256 tokenId, uint64 duration, uint256 minMooneyOut) external payable nonReentrant {
        if (paused) revert PausedCheckout();
        address owner = citizen.ownerOf(tokenId);
        (uint256 treasury, , uint256 total) = quote(owner, duration);
        if (treasury == 0) {
            citizen.renewSubscription{value: 0}(tokenId, duration);
            _refund(msg.sender, msg.value);
            return;
        }
        if (msg.value < total) revert PaymentTooLow(total, msg.value);
        citizen.renewSubscription{value: treasury}(tokenId, duration);
        _buyAndDeliver(owner, msg.value - treasury, minMooneyOut);
    }

    /// @notice Sponsor path for free and partial invites. `stakeWei` is the
    ///         amount of this payment that buys MOONEY. The rest of `msg.value`
    ///         above the treasury price is refunded to the sponsor. A free
    ///         invite passes `stakeWei = 0`.
    function mintSponsored(Profile calldata profile, uint256 stakeWei, uint256 minMooneyOut)
        external
        payable
        nonReentrant
        returns (uint256 tokenId)
    {
        if (paused) revert PausedCheckout();
        if (msg.sender != sponsor && msg.sender != owner()) revert NotSponsor();
        uint256 treasury = citizen.getRenewalPrice(profile.to, ONE_YEAR);
        if (msg.value < treasury + stakeWei) revert PaymentTooLow(treasury + stakeWei, msg.value);
        tokenId = _mint(profile, treasury);
        if (stakeWei > 0) _buyAndDeliver(profile.to, stakeWei, minMooneyOut);
        _refund(msg.sender, msg.value - treasury - stakeWei);
    }

    /// @dev `mintTo` takes ten arguments. Encoding that call in one function
    ///      overruns the stack under the coverage compiler, so the profile is
    ///      encoded in two halves and stitched.
    function _mint(Profile calldata profile, uint256 treasury) internal returns (uint256 tokenId) {
        bytes memory head = _encodeHead(profile.to, profile.name, profile.bio, profile.image, profile.location);
        bytes memory tail = _encodeTail(
            profile.discord, profile.twitter, profile.website, profile.viewData, profile.formId
        );
        bytes memory args = _joinProfile(head, tail);
        address citizenAddr = address(citizen);
        bytes4 selector = IMoonDAOCitizen.mintTo.selector;
        assembly {
            let data := add(args, 32)
            let len := mload(args)
            let dest := mload(0x40)
            mstore(dest, selector)
            let src := data
            let end := add(src, len)
            for {} lt(src, end) {} {
                mstore(add(dest, add(4, sub(src, data))), mload(src))
                src := add(src, 32)
            }
            let total := add(len, 4)
            let ok := call(gas(), citizenAddr, treasury, dest, total, 0, 32)
            if iszero(ok) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
            tokenId := mload(0)
        }
    }

    function _encodeHead(
        address to,
        string calldata name,
        string calldata bio,
        string calldata image,
        string calldata location
    ) internal pure returns (bytes memory) {
        return abi.encode(to, name, bio, image, location);
    }

    function _encodeTail(
        string calldata discord,
        string calldata twitter,
        string calldata website,
        string calldata viewData,
        string calldata formId
    ) internal pure returns (bytes memory) {
        return abi.encode(discord, twitter, website, viewData, formId);
    }

    /// @dev Stitch two 5-word ABI blobs into the 10-word mintTo argument block.
    function _joinProfile(bytes memory head, bytes memory tail) internal pure returns (bytes memory) {
        uint256 headBodies = head.length - 160;
        uint256 tailBodies = tail.length - 160;
        bytes memory out = new bytes(320 + headBodies + tailBodies);
        // address
        assembly {
            mstore(add(out, 32), mload(add(head, 32)))
        }
        // First four strings lived at head offsets; shift them by +160 so they
        // sit after a 10-word head instead of a 5-word head.
        for (uint256 i = 0; i < 4; i++) {
            uint256 oldOff;
            assembly {
                oldOff := mload(add(head, add(64, mul(i, 32))))
            }
            uint256 newOff = oldOff + 160;
            assembly {
                mstore(add(out, add(64, mul(i, 32))), newOff)
            }
        }
        for (uint256 i = 0; i < 5; i++) {
            uint256 oldOff;
            assembly {
                oldOff := mload(add(tail, add(32, mul(i, 32))))
            }
            uint256 newOff = 160 + headBodies + oldOff;
            assembly {
                mstore(add(out, add(192, mul(i, 32))), newOff)
            }
        }
        // Copy bodies. Head bodies start at byte 160 of `head`.
        assembly {
            let dest := add(out, 352) // 32 length prefix + 320 head
            let hlen := sub(mload(head), 160)
            let src := add(head, 192) // 32 length prefix + 160
            for { let i := 0 } lt(i, hlen) { i := add(i, 32) } {
                mstore(add(dest, i), mload(add(src, i)))
            }
            dest := add(dest, hlen)
            let tlen := sub(mload(tail), 160)
            src := add(tail, 192)
            for { let i := 0 } lt(i, tlen) { i := add(i, 32) } {
                mstore(add(dest, i), mload(add(src, i)))
            }
        }
        return out;
    }

    function setSponsor(address sponsor_) external onlyOwner {
        sponsor = sponsor_;
        emit SponsorUpdated(sponsor_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit Paused(paused_);
    }

    function _refund(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "refund");
    }

    function _buyAndDeliver(address to, uint256 stakeWei, uint256 minMooneyOut) internal {
        if (minMooneyOut == 0) revert Slippage();
        weth.deposit{value: stakeWei}();
        require(weth.approve(address(swapRouter), stakeWei), "approve");
        uint256 bought = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(weth),
                tokenOut: address(mooney),
                fee: poolFee,
                recipient: address(this),
                amountIn: stakeWei,
                amountOutMinimum: minMooneyOut,
                sqrtPriceLimitX96: 0
            })
        );
        mooney.safeTransfer(to, bought);
        bool locked = _tryLock(to, bought);
        emit Stake(to, bought, locked);
    }

    /// @dev vMOONEY `deposit_for` pulls MOONEY from the citizen, and only into
    ///      a lock that is already open. A first lock is a later signature from
    ///      that wallet (`create_lock`).
    function _tryLock(address to, uint256 amount) internal returns (bool locked) {
        try ve.locked(to) returns (int128 lockedAmount, uint256 end) {
            if (lockedAmount <= 0 || end <= block.timestamp) return false;
            if (mooney.allowance(to, address(ve)) < amount) return false;
            try ve.deposit_for(to, amount) {
                return true;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }
}
