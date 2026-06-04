import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

/** Domain chains: same factory + SALT + artifact => same EntryPoint address (not Ethereum mainnet). */
const DOMAIN_CHAIN_IDS = new Set([704, 678])

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  console.log('deployer=', from)

  const create2Dep = await hre.deployments.get('Create2Deployer')
  const envFactory = process.env.DOMAIN_CREATE2_FACTORY?.trim() ??
    process.env.NDACHAIN_CREATE2_FACTORY?.trim()
  const create2Factory = (envFactory != null && envFactory !== '')
    ? envFactory
    : create2Dep.address

  const chainId = Number((await provider.getNetwork()).chainId)
  const factoryCode = await provider.getCode(create2Factory)
  if (factoryCode === '0x') {
    throw new Error(
      `CREATE2 factory ${create2Factory} has no bytecode on chain ${chainId}. ` +
      'Run deploy/0_deploy_Create2Deployer.ts or set DOMAIN_CREATE2_FACTORY to the same address on every domain chain.'
    )
  }

  const forceDirect = process.env.DOMAIN_ENTRYPOINT_DIRECT_DEPLOY === 'true' ||
    process.env.NDACHAIN_ENTRYPOINT_DIRECT_DEPLOY === 'true'
  const isDomainChain = DOMAIN_CHAIN_IDS.has(chainId)
  const useDeterministic = !forceDirect && (isDomainChain || process.env.FORCE_ENTRYPOINT_CREATE2 === 'true')

  if (isDomainChain && useDeterministic) {
    console.log(
      'Domain chain', chainId, ': EntryPoint CREATE2 factory=', create2Factory,
      'SALT=', process.env.SALT
    )
  }

  const gasLimit = useDeterministic ? 8e6 : 8e6
  console.log('EntryPoint gasLimit=', gasLimit, 'deterministic=', useDeterministic)

  const ret = await hre.deployments.deploy(
    'EntryPoint', {
      contract: 'NDAEntryPoint',
      from,
      args: [],
      gasLimit,
      deterministicDeployment: useDeterministic ? (process.env.SALT ?? true) : false,
      log: true
    })
  console.log('==NDAEntryPoint (EntryPoint) addr=', ret.address)
}

deployEntryPoint.dependencies = ['Create2Deployer']
deployEntryPoint.tags = ['EntryPoint']

export default deployEntryPoint
