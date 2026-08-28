export type CurrentPolicyVersions = {
  termsVersion: string;
  privacyVersion: string;
};

function policyVersion(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value || value.length > 64) {
    throw new Error("onboarding_config_invalid");
  }
  return value;
}

export function getCurrentPolicyVersions(
  env: NodeJS.ProcessEnv = process.env,
): CurrentPolicyVersions {
  return {
    termsVersion: policyVersion(env, "TERMS_VERSION"),
    privacyVersion: policyVersion(env, "PRIVACY_VERSION"),
  };
}
