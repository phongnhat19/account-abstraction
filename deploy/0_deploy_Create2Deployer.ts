import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

/** Global Arachnid proxy (requires pre-signed bootstrap tx — not allowlisted on Besu). */
export const GLOBAL_CREATE2_PROXY = '0x4e59b44847b379578588920ca78fbf26c0b4956c'

const deployCreate2Deployer: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const chainId = Number((await provider.getNetwork()).chainId)

  const globalCode = await provider.getCode(GLOBAL_CREATE2_PROXY)
  if (globalCode !== '0x') {
    console.log('CREATE2: using global proxy at', GLOBAL_CREATE2_PROXY)
    const existing = await hre.deployments.getOrNull('Create2Deployer')
    if (existing?.address?.toLowerCase() === GLOBAL_CREATE2_PROXY.toLowerCase()) {
      return
    }
    await hre.deployments.save('Create2Deployer', {
      address: GLOBAL_CREATE2_PROXY,
      abi: (await hre.artifacts.readArtifact('Create2Deployer')).abi
    })
    return
  }

  const envFactory = process.env.NDACHAIN_CREATE2_FACTORY
  if (envFactory != null && envFactory !== '') {
    const code = await provider.getCode(envFactory)
    if (code === '0x') {
      throw new Error(`NDACHAIN_CREATE2_FACTORY=${envFactory} has no code on chain ${chainId}`)
    }
    console.log('CREATE2: using NDACHAIN_CREATE2_FACTORY=', envFactory)
    await hre.deployments.save('Create2Deployer', {
      address: envFactory,
      abi: (await hre.artifacts.readArtifact('Create2Deployer')).abi
    })
    return
  }

  console.log(
    'CREATE2: global proxy absent — deploying Create2Deployer with allowlisted key',
    '(chainId=', chainId, ')'
  )
  await hre.deployments.deploy('Create2Deployer', {
    contract: 'Create2Deployer',
    from,
    args: [],
    gasLimit: 2e6,
    deterministicDeployment: false,
    log: true
  })
}

export default deployCreate2Deployer
