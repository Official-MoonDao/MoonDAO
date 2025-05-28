// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

// import { console2 } from "forge-std/Test.sol"; // remove before deploy
import { HatsModule } from "@hats-module/HatsModule.sol";

/*//////////////////////////////////////////////////////////////
                            CUSTOM ERRORS
//////////////////////////////////////////////////////////////*/

/// @notice Thrown when the caller is not wearing the {hatId} hat
error NotAuthorized();

/**
 * @title PassthroughModule
 * @author spengrah
 * @author Haberdasher Labs
 * @notice This module allows the wearer(s) of a given "criterion" hat to serve as the eligibilty and/or toggle module
 * for a different hat. It effectively serves as an extension of a hat, enabling the hat itself to serve as the module
 * even though only addresses can be set as modules.
 * @dev This contract inherits from HatsModule, and is intended to be deployed as minimal proxy clone(s) via
 * HatsModuleFactory. For this contract to be used, it must be set as either the eligibility or toggle module for
 * another hat.
 */
contract PassthroughModule is HatsModule {
  /*//////////////////////////////////////////////////////////////
                            CONSTANTS 
  //////////////////////////////////////////////////////////////*/

  /**
   * This contract is a clone with immutable args, which means that it is deployed with a set of
   * immutable storage variables (ie constants). Accessing these constants is cheaper than accessing
   * regular storage variables (such as those set on initialization of a typical EIP-1167 clone),
   * but requires a slightly different approach since they are read from calldata instead of storage.
   *
   * Below is a table of constants and their location.
   *
   * For more, see here: https://github.com/Saw-mon-and-Natalie/clones-with-immutable-args
   *
   * ----------------------------------------------------------------------+
   * CLONE IMMUTABLE "STORAGE"                                             |
   * ----------------------------------------------------------------------|
   * Offset  | Constant          | Type    | Length  | Source              |
   * ----------------------------------------------------------------------|
   * 0       | IMPLEMENTATION    | address | 20      | HatsModule          |
   * 20      | HATS              | address | 20      | HatsModule          |
   * 40      | hatId             | uint256 | 32      | HatsModule          |
   * 72      | CRITERION_HAT     | uint256 | 32      | PassthroughModule   |
   * ----------------------------------------------------------------------+
   */

  function CRITERION_HAT() public pure returns (uint256) {
    return _getArgUint256(72);
  }

  /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
  //////////////////////////////////////////////////////////////*/

  /// @notice Deploy the implementation contract and set its version
  /// @dev This is only used to deploy the implementation contract, and should not be used to deploy clones
  constructor(string memory _version) HatsModule(_version) { }

  /*//////////////////////////////////////////////////////////////
                            INITIALIZER
  //////////////////////////////////////////////////////////////*/

  /// @inheritdoc HatsModule
  function _setUp(bytes calldata) internal override {
    // no initial values to set
  }

  /*//////////////////////////////////////////////////////////////
                          ELIGIBILITY FUNCTION
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Set the eligibility status of a `_hatId` for a `_wearer`, mi
   * @dev Only callable by the wearer(s) of the {hatId} hat. Will revert if this instance is not set as the eligibility
   * module for the `_hatId` hat.
   * @param _hatId The hat to set the eligibility status for
   * @param _wearer The address to set the eligibility status for
   * @param _eligible The new _wearer's eligibility, where TRUE = eligible
   * @param _standing The new _wearer's standing, where TRUE = in good standing
   */
  function setHatWearerStatus(uint256 _hatId, address _wearer, bool _eligible, bool _standing) public onlyWearer {
    HATS().setHatWearerStatus(_hatId, _wearer, _eligible, _standing);
  }

  /*//////////////////////////////////////////////////////////////
                          TOGGLE FUNCTION
  //////////////////////////////////////////////////////////////*/

  /**
   * @notice Toggle the status of `_hatId`
   * @dev Only callable by the wearer(s) of the {hatId} hat. Will revert if this instance is not set as the toggle
   * module for the `_hatId` hat.
   * @param _hatId The hat to set the status for
   * @param _newStatus The new status, where TRUE = active
   */
  function setHatStatus(uint256 _hatId, bool _newStatus) public onlyWearer {
    HATS().setHatStatus(_hatId, _newStatus);
  }

  /*//////////////////////////////////////////////////////////////
                            MODIFIERS
  //////////////////////////////////////////////////////////////*/

  /// @notice Reverts if the caller is not wearing the {hatId} hat
  modifier onlyWearer() {
    if (!HATS().isWearerOfHat(msg.sender, CRITERION_HAT())) revert NotAuthorized();
    _;
  }
}