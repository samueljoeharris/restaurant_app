import {
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  multiFactor,
  type Auth,
  type MultiFactorInfo,
  type MultiFactorResolver,
  type User,
} from "firebase/auth";

export type TotpEnrollment = {
  secret: TotpSecret;
  qrCodeUrl: string;
};

export async function startTotpEnrollment(user: User): Promise<TotpEnrollment> {
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const qrCodeUrl = secret.generateQrCodeUrl(
    user.email ?? "user",
    "Time to Fries",
  );
  return { secret, qrCodeUrl };
}

export async function finishTotpEnrollment(
  user: User,
  secret: TotpSecret,
  verificationCode: string,
): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    secret,
    verificationCode,
  );
  await multiFactor(user).enroll(assertion, "Authenticator app");
}

export function getTotpResolver(
  auth: Auth,
  error: unknown,
): MultiFactorResolver | null {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "auth/multi-factor-auth-required"
  ) {
    return getMultiFactorResolver(auth, error as never);
  }
  return null;
}

export function totpHint(resolver: MultiFactorResolver): MultiFactorInfo | null {
  const hint = resolver.hints.find(
    (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );
  return hint ?? resolver.hints[0] ?? null;
}

export async function completeTotpSignIn(
  resolver: MultiFactorResolver,
  hint: MultiFactorInfo,
  verificationCode: string,
): Promise<void> {
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    hint.uid,
    verificationCode,
  );
  await resolver.resolveSignIn(assertion);
}

export function userHasTotpMfa(user: User): boolean {
  return multiFactor(user).enrolledFactors.some(
    (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID,
  );
}
