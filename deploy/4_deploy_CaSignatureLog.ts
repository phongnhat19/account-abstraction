import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const deployCaSignatureLog: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  const network = await provider.getNetwork()

  if (network.chainId !== 31337 && network.chainId !== 1337) {
    return
  }

  const publisher = process.env.IDENTITY_SERVICE_PUBLISHER ?? from

  await hre.deployments.deploy('CaSignatureLog', {
    from,
    args: [publisher],
    gasLimit: 4e6,
    log: true
  })
}

export default deployCaSignatureLog
