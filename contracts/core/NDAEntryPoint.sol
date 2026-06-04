// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "./EntryPoint.sol";

/**
 * @title NDAEntryPoint
 * @notice EntryPoint for gas-free NDAChain: no prefund, no gas settlement charges.
 */
contract NDAEntryPoint is EntryPoint {
    function _getRequiredPrefund(MemoryUserOp memory)
        internal
        pure
        override
        returns (uint256 requiredPrefund)
    {
        return 0;
    }

    function _getUserOpGasPrice(MemoryUserOp memory)
        internal
        pure
        override
        returns (uint256)
    {
        return 0;
    }

    function _getUnusedGasPenalty(uint256, uint256)
        internal
        pure
        override
        returns (uint256)
    {
        return 0;
    }
}
