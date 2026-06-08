import 'hardhat-deploy/dist/src/type-extensions'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import { HardhatUserConfig, task } from 'hardhat/config'
import type { DeterministicDeploymentInfo } from 'hardhat-deploy/types'
import 'hardhat-deploy'

import * as fs from 'fs'
import * as path from 'path'

/** Load account-abstraction/.env into process.env (Hardhat does not do this by default). */
function loadDotEnv (filePath: string): void {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadDotEnv(path.join(__dirname, '.env'))

const SALT = '0x7702864008ddeab30aa67b7adc3d2653bc8d162714b1fe8fe4582df814f3bf61'
process.env.SALT = process.env.SALT ?? SALT

task('deploy', 'Deploy contracts')
  .addFlag('ndaAccountFactory', 'force NDAAccountFactory deploy on networks other than localhost / ndachain')

task('onboard-ndachain', 'Deploy NDA smart account from onboarding.json (UID CREATE2 salt)')
  .addOptionalParam('file', 'Path to onboarding.json', path.join(__dirname, 'test/onboarding.json'))
  .addFlag('dryrun', 'Print counterfactual address only; do not submit handleOps')
  .setAction(async (taskArgs, hre) => {
    const { onboardNdaChain } = await import('./scripts/onboard-ndachain-lib')
    await onboardNdaChain({
      hre,
      onboardingPath: taskArgs.file,
      dryRun: taskArgs.dryrun
    })
  })

const mnemonicFileName = process.env.MNEMONIC_FILE
let mnemonic = 'test '.repeat(11) + 'junk'
if (mnemonicFileName != null && mnemonicFileName !== '' && fs.existsSync(mnemonicFileName)) {
  mnemonic = fs.readFileSync(mnemonicFileName, 'ascii')
}

function getNetwork1 (url: string): { url: string, accounts: { mnemonic: string } } {
  return {
    url,
    accounts: { mnemonic }
  }
}

function getNetwork (name: string): { url: string, accounts: { mnemonic: string } } {
  return getNetwork1(`https://${name}.infura.io/v3/${process.env.INFURA_ID}`)
  // return getNetwork1(`wss://${name}.infura.io/ws/v3/${process.env.INFURA_ID}`)
}

/** CREATE2 factory for hardhat-deploy deterministicDeployment (per-chain deployments folder). */
function readCreate2FactoryAddress (chainId: number): string | undefined {
  const foldersByChain: Record<number, string[]> = {
    704: ['ndachain'],
    31337: ['localhost', 'hardhat'],
    1337: ['localhost', 'ganache'],
    1: ['ethereum', 'mainnet']
  }
  for (const folder of foldersByChain[chainId] ?? []) {
    const filePath = path.join(__dirname, 'deployments', folder, 'Create2Deployer.json')
    if (!fs.existsSync(filePath)) continue
    const deployment = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { address?: string }
    if (deployment.address != null && deployment.address !== '') {
      return deployment.address
    }
  }
  return undefined
}

/** Domain chains: same CREATE2 factory address in .env on every network. */
function resolveCreate2FactoryAddress (chainId: number): string | undefined {
  if (chainId === 704 || chainId === 678) {
    const envFactory = (process.env.DOMAIN_CREATE2_FACTORY ?? process.env.NDACHAIN_CREATE2_FACTORY)?.trim()
    if (envFactory != null && envFactory !== '') {
      return envFactory
    }
  }
  return readCreate2FactoryAddress(chainId)
}

/** Smaller initcode helps CREATE2 deploy on Besu domain chains (viaIR + 1M runs ~24KB initcode). */
const entryPointCompilerSettings = {
  version: '0.8.28',
  settings: {
    evmVersion: 'cancun',
    optimizer: { enabled: true, runs: 200 },
    viaIR: false
  }
}

const optimizedCompilerSettings = {
  version: '0.8.28',
  settings: {
    evmVersion: 'cancun',
    optimizer: { enabled: true, runs: 1000000 },
    viaIR: true
  }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  deterministicDeployment: (chainId: string): DeterministicDeploymentInfo | undefined => {
    const factory = resolveCreate2FactoryAddress(Number(chainId))
    if (factory != null) {
      return { factory } as DeterministicDeploymentInfo
    }
    return undefined
  },
  solidity: {
    compilers: [{
      version: '0.8.28',
      settings: {
        evmVersion: 'cancun',
        viaIR: true,
        optimizer: { enabled: true, runs: 1000000 }
      }
    }],
    overrides: {
      'contracts/core/EntryPoint.sol': optimizedCompilerSettings,
      'contracts/core/EntryPointSimulations.sol': optimizedCompilerSettings,
      'contracts/core/NDAEntryPoint.sol': entryPointCompilerSettings,
      // 'contracts/core/EntryPoint.sol': entryPointCompilerSettings,
      'contracts/accounts/NDAAccount.sol': optimizedCompilerSettings
    }
  },
  networks: {
    dev: { url: 'http://localhost:8545' },
    // github action starts localgeth service, for gas calculations
    localgeth: { url: 'http://localgeth:8545' },
    sepolia: getNetwork('sepolia'),
    proxy: getNetwork1('http://localhost:8545'),
    ndachain: {
      url: process.env.NDACHAIN_RPC_URL ?? "http://10.0.1.60:8545",
      chainId: 704,
      accounts:
        process.env.NDACHAIN_PRIVATE_KEY !== undefined && process.env.NDACHAIN_PRIVATE_KEY !== ""
          ? [process.env.NDACHAIN_PRIVATE_KEY]
          : [],
    },
    /** Besu sidechain RPC (smoke script uses SIDECHAIN_RPC_URL + SIDECHAIN_CHAIN_ID env, not this network). */
    pilachain: {
      url: "http://10.1.1.201:8545",
      chainId: 678,
      accounts:
        process.env.PILACHAIN_PRIVATE_KEY !== undefined && process.env.PILACHAIN_PRIVATE_KEY !== ""
          ? [process.env.PILACHAIN_PRIVATE_KEY]
          : [],
    },
  },
  mocha: {
    timeout: 10000
  }
}

export default config
