
# Description

This repository contains the tools and resources for working with [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) Account Abstraction smart contracts. This includes the code for the singleton `EntryPoint` contract that is deployed by our team on most EVM-compatible networks.

# Overview

Account abstraction allows users to interact with Ethereum using smart contract wallets instead of EOAs, without compromising decentralization, providing benefits like:

- Social recovery
- Batched transactions
- Sponsored transactions (gas abstraction)
- Signature abstraction
- Advanced authorization logic

# Repository Structure 

## Core Components

- **EntryPoint Contract** (`contracts/core/EntryPoint.sol`): The central contract that processes UserOperations
- **BaseAccount** (`contracts/core/BaseAccount.sol`): Base implementation for smart contract accounts
- **BasePaymaster** (`contracts/core/BasePaymaster.sol`): Helper class for creating a paymaster
- **StakeManager** (`contracts/core/StakeManager.sol`): Manages deposits and stakes for accounts and paymasters
- **NonceManager** (`contracts/core/NonceManager.sol`): Handles nonce management for accounts
- **UserOperationLib** (`contracts/core/UserOperationLib.sol`): Utilities for working with UserOperations
- **Helpers** (`contracts/core/Helpers.sol`): Common constants and helper functions


## Sample Implementations

- **NDAAccount** (`contracts/accounts/NDAAccount.sol`): ERC-4337 account for NDAChain (gas-free). Does not validate `userOp.signature` for CA RSA; Vietnamese CA signatures are published via `CaSignatureLog` after off-chain verification by the identity service.

- **NDAAccountFactory** (`contracts/accounts/NDAAccountFactory.sol`): Factory for `NDAAccount`

- **NDAEntryPoint** (`contracts/core/NDAEntryPoint.sol`): EntryPoint with zero prefund and zero gas settlement for gas-free NDAChain. Deployed as `EntryPoint` via hardhat-deploy.

- **CaSignatureLog** (`contracts/CaSignatureLog.sol`): On-chain public log of per-transaction RSA signatures (`UserCaSignatureRecorded` event). Callable only by `PUBLISHER_ROLE` (identity service).

### NDAChain deploy (hardhat-deploy)

On localhost / NDAChain, deploy only:

0. `0_deploy_Create2Deployer.ts` — Arachnid-compatible CREATE2 proxy (your allowlisted key on NDAChain)
1. `1_deploy_entrypoint.ts` — `NDAEntryPoint` (saved as `EntryPoint`)
2. `2_deploy_NDAAccountFactory.ts` — `NDAAccountFactory` + `TestCounter`
3. `4_deploy_CaSignatureLog.ts` — `CaSignatureLog`

`Simple7702Account` remains in the repo for upstream EIP-7702 tests only; it is **not** deployed for NDA.

### Onboard smart account on NDAChain (from `onboarding.json`)

After deploy, create the per-identity account (CREATE2 via `NDAAccountFactory`, salt from `UID=` in certificate subject):

```bash
yarn onboard:ndachain
yarn onboard:ndachain:dry
# custom JSON:
npx hardhat onboard-ndachain --network ndachain --file ./test/onboarding.json
```

- `NDA_ACCOUNT_OWNER` — optional owner address (default: bundler / `NDACHAIN_PRIVATE_KEY`)
- `ONBOARDING_JSON` — optional path to onboarding JSON (default: `test/onboarding.json`)
- Counterfactual address: `NDAAccountFactory.getAddress(owner, keccak256(utf8(uid)))`
- The onboarding script sets `gasLimit: 5_000_000` on the outer `handleOps` tx; default RPC estimation (~230k) reverts on account creation.

This is separate from EntryPoint singleton deploy (global CREATE2 proxy does not work on Besu).

### NDAChain deploy env

Create `account-abstraction/.env` (loaded automatically by `hardhat.config.ts`):

- `NDACHAIN_RPC_URL` — optional; defaults to `http://10.0.1.60:8545`
- `NDACHAIN_PRIVATE_KEY` — allowlisted deployer key for `--network ndachain` (required on NDAChain)
- `NDACHAIN_FORCE_DETERMINISTIC` — set `true` to force CREATE2 + `SALT` on NDAChain (usually fails on Besu; direct deploy is default on chain 704)

**NDAChain (704) deploy:** `NDAEntryPoint` and `NDAAccountFactory` use **direct deploy** (~5M gas), not CREATE2. Besu rejects CREATE2 initcode deploys even at 22M–50M+ gas (`gasUsed` ≈ entire `gasLimit`). `Create2Deployer` (step 0) is optional for tooling; per-user account CREATE2 via `NDAAccountFactory` still works. EntryPoint address on NDA will differ from SALT-canonical mainnet addresses.
- `IDENTITY_SERVICE_PUBLISHER` — address granted `PUBLISHER_ROLE` on `CaSignatureLog` (defaults to deployer on localhost)


# Developer setup

## Installation 

### Clone the repository:

````bash
git clone https://github.com/eth-infinitism/account-abstraction.git
cd account-abstraction
yarn install
````
### Compilation:

```bash
yarn compile
```

### Testing:

```bash
yarn test
``` 
	

## Entrypoint Deployment

The EntryPoint contract is the central hub for processing UserOperations. It:
- Validates UserOperations
- Handles account creation (if needed)
- Executes the requested operations
- Manages gas payments and refunds

The EntryPoint is deployed by using 

```bash
hardhat deploy --network {net}
```

[EntryPoint v0.8](https://github.com/eth-infinitism/account-abstraction/releases/latest) is always deployed at address `0x4337084d9e255ff0702461cf8895ce9e3b5ff108`

This repository also includes a number of audited base classes and utilities that can simplify the development of AA related contracts.

## Usage
### For projects integrating the library 

If you are building a project that uses account abstraction and want to integrate our contracts:

```bash
yarn add @account-abstraction/contracts
```

### For Paymaster development

```solidity
import "@account-abstraction/contracts/core/BasePaymaster.sol";

contract MyCustomPaymaster is BasePaymaster {
    /// implement your gas payment logic here
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal virtual override returns (bytes memory context, uint256 validationData) {
        context = “”; // specify “context” if needed in postOp call. 
        validationData = _packValidationData(
            false,
            validUntil,
            validAfter
        );
    }
}

```



### For Smart Contract Account development

```bash
import "@account-abstraction/contracts/core/BaseAccount.sol";

contract MyAccount is BaseAccount {

    /// implement your authentication logic here
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256 validationData) {

        // UserOpHash can be generated using eth_signTypedData_v4
        if (owner != ECDSA.recover(userOpHash, userOp.signature))
            return SIG_VALIDATION_FAILED;
        return SIG_VALIDATION_SUCCESS;
    }
}
```

# Resources

- [Homepage](https://www.erc4337.io/)
- [Blog](https://erc4337.mirror.xyz/)
- [X Account](https://x.com/erc4337)
- [YouTube Channel](https://www.youtube.com/@ERC-4337)
- [Bundlebear](https://www.bundlebear.com/overview/all)
- [Vitalik Buterin - a history of account abstraction](https://www.youtube.com/watch?v=iLf8qpOmxQc)
- [Beyond 4337: Vitalik Buterin's Vision for the Future of Account Abstraction](https://www.youtube.com/watch?v=zpqa1Z4UpiA)
- [Exploring the Future of Account Abstraction by Yoav Weiss](https://www.youtube.com/watch?v=63Wd5mPla-M)
- [Native Account Abstraction in Pectra, rollups and beyond](https://www.youtube.com/watch?v=FYanFF-yU6w)
- [Vitalik Buterin - account abstraction without Ethereum protocol changes](https://medium.com/infinitism/erc-4337-account-abstraction-without-ethereum-protocol-changes-d75c9d94dc4a)
- [Unified ERC-4337 mempool](https://notes.ethereum.org/@yoav/unified-erc-4337-mempool)
- [Bundler reference implementation](https://github.com/eth-infinitism/bundler)
- [Discord server](http://discord.gg/fbDyENb6Y9)
