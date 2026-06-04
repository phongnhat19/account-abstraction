/**
 * Deterministic NDAEntryPoint address for your domain chains.
 * Same address when: same DOMAIN_CREATE2_FACTORY, same SALT, same compiled artifact.
 */
import * as fs from 'fs'
import * as path from 'path'
import { ethers } from 'ethers'

const SALT =
  process.env.SALT ??
  '0x7702864008ddeab30aa67b7adc3d2653bc8d162714b1fe8fe4582df814f3bf61'

function main (): void {
  const artifactPath = path.join(
    __dirname,
    '../artifacts/contracts/core/NDAEntryPoint.sol/NDAEntryPoint.json'
  )
  if (!fs.existsSync(artifactPath)) {
    throw new Error('Compile first: npx hardhat compile')
  }
  const { bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as {
    bytecode: string
  }
  const factory =
    process.env.DOMAIN_CREATE2_FACTORY?.trim() ??
    process.env.NDACHAIN_CREATE2_FACTORY?.trim()
  if (factory == null || factory === '') {
    throw new Error('Set DOMAIN_CREATE2_FACTORY (same address on every domain chain)')
  }

  const initCodeHash = ethers.utils.keccak256(bytecode)
  console.log('DOMAIN_CREATE2_FACTORY:', factory)
  console.log('SALT:', SALT)
  console.log('initCode bytes:', (bytecode.length - 2) / 2)
  console.log('initCodeHash:', initCodeHash)
  console.log('EntryPoint address:', ethers.utils.getCreate2Address(factory, SALT, initCodeHash))
}

main()
