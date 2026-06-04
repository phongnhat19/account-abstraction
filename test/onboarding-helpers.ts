import * as fs from 'fs'
import * as path from 'path'
import { BigNumber } from 'ethers'
import { keccak256 } from 'ethers/lib/utils'

export interface OnboardingJson {
  identity: {
    subject: string
    issuer: string
    serialNumber: string
    validFrom: string
    validTo: string
    fingerprintSha256: string
    certificate: string
    publicKey: string
  }
  signature: string
}

/** UID from account-abstraction/test/onboarding.json */
export const EXPECTED_ONBOARDING_UID = 'MST:0319333973'

export function loadOnboardingJson (
  filePath = path.join(__dirname, 'onboarding.json')
): OnboardingJson {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as OnboardingJson
}

export function parseUidFromSubject (subject: string): string {
  const match = subject.match(/UID=([^\n\\]+)/)
  if (!match) {
    throw new Error('UID= not found in certificate subject')
  }
  return match[1].trim()
}

/** Deterministic CREATE2 salt for NDAAccountFactory from Vietnamese CA UID (e.g. MST:0319333973). */
export function uidToCreate2Salt (uid: string): BigNumber {
  return BigNumber.from(keccak256(Buffer.from(uid, 'utf8')))
}

export function fingerprintToBytes32 (fingerprintSha256: string): string {
  const hex = fingerprintSha256.replace(/:/g, '')
  if (hex.length !== 64) {
    throw new Error(`invalid fingerprintSha256: ${fingerprintSha256}`)
  }
  return '0x' + hex
}
