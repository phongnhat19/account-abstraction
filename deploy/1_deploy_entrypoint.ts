import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  console.log('deployer=', from)

  const create2 = await hre.deployments.get('Create2Deployer')
  console.log('CREATE2 factory (not used for EntryPoint on 704):', create2.address)

  const chainId = Number((await provider.getNetwork()).chainId)
  // Besu NDAChain: CREATE2 initcode deploy consumes ~full gasLimit and reverts (tested 22M–50M+).
  // Direct deploy succeeds (~5M gas). SALT-canonical EntryPoint address is not used on 704.
  const useDeterministic =
    chainId !== 704 && process.env.NDACHAIN_FORCE_DETERMINISTIC !== 'true'
  const gasLimit = useDeterministic ? 12e6 : 8e6
  if (chainId === 704) {
    console.warn(
      'NDAChain (704): NDAEntryPoint direct deploy (deterministicDeployment=false).'
    )
  }
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
