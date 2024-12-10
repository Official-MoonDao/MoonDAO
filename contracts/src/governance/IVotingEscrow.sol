// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IVotingEscrow {
    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    function locked(address) external view returns (LockedBalance memory);

    function balanceOf(address) external view returns (uint256);
    function deploy_for(address _addr, uint256 _value) external;
    function commit_smart_wallet_checker(address) external;
    function apply_smart_wallet_checker() external;

    function admin() external view returns (address);
    function create_lock(uint256 _value, uint256 _unlock_time) external;
    function totalSupply() external view returns (uint256);
    function checkpoint() external;
    function user_point_history(address, uint256) external view returns (uint256, uint256);
    function user_point_history__ts(address, uint256) external view returns (uint256);
    function get_last_user_slope(address) external view returns (int128);

}
