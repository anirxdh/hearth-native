import type { WorkflowBuilder } from '../builder';
import { claimDenialAppeal } from './claimDenialAppeal';
import { dischargeToHome } from './dischargeToHome';
import { hipaaRecordsRelease } from './hipaaRecordsRelease';
import { medicaidRenewal } from './medicaidRenewal';
import { newPatientIntake } from './newPatientIntake';
import { priorAuthorization } from './priorAuthorization';

export { claimDenialAppeal } from './claimDenialAppeal';
export { dischargeToHome } from './dischargeToHome';
export { hipaaRecordsRelease } from './hipaaRecordsRelease';
export { medicaidRenewal } from './medicaidRenewal';
export { newPatientIntake } from './newPatientIntake';
export { priorAuthorization } from './priorAuthorization';

/**
 * Every bundled template, keyed for seeding and the library screen. The key
 * duplicates the builder's meta key on purpose: callers can look a template
 * up without building it first.
 */
export const ALL_TEMPLATES: { key: string; build: (now: string) => WorkflowBuilder }[] = [
  { key: 'claim-denial-appeal', build: claimDenialAppeal },
  { key: 'hipaa-records-release', build: hipaaRecordsRelease },
  { key: 'prior-authorization', build: priorAuthorization },
  { key: 'medicaid-renewal', build: medicaidRenewal },
  { key: 'discharge-to-home', build: dischargeToHome },
  { key: 'new-patient-intake', build: newPatientIntake },
];
