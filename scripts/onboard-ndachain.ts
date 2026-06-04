import hre from 'hardhat'
import { onboardNdaChain } from './onboard-ndachain-lib'

async function main (): Promise<void> {
  await onboardNdaChain({ hre })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
