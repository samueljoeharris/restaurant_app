import {
  EmailAuthProvider,
  GoogleAuthProvider,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  multiFactor,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
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
    "Little Scout",
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

export function getTotpFactor(user: User): MultiFactorInfo | null {
  return (
    multiFactor(user).enrolledFactors.find(
      (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID,
    ) ?? null
  );
}

export function userHasTotpMfa(user: User): boolean {
  return getTotpFactor(user) !== null;
}

export async function unenrollTotp(user: User): Promise<void> {
  const factor = getTotpFactor(user);
  if (!factor) return;
  await multiFactor(user).unenroll(factor.uid);
}

export function isRequiresRecentLogin(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "auth/requires-recent-login"
  );
}

export function isMfaResolverError(
  error: unknown,
): error is { mfaResolver: MultiFactorResolver } {
  return (
    !!error &&
    typeof error === "object" &&
    "mfaResolver" in error &&
    !!(error as { mfaResolver: MultiFactorResolver }).mfaResolver
  );
}

export function userHasPasswordProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === "password");
}

export function userHasGoogleProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === "google.com");
}

export async function reauthenticateUser(
  auth: Auth,
  user: User,
  options: { password?: string; google?: boolean },
): Promise<void> {
  if (options.google) {
    const provider = new GoogleAuthProvider();
    try {
      await reauthenticateWithPopup(user, provider);
    } catch (err) {
      const resolver = getTotpResolver(auth, err);
      if (resolver) throw { mfaResolver: resolver };
      throw err;
    }
    return;
  }

  if (options.password && user.email) {
    const credential = EmailAuthProvider.credential(
      user.email,
      options.password,
    );
    try {
      await reauthenticateWithCredential(user, credential);
    } catch (err) {
      const resolver = getTotpResolver(auth, err);
      if (resolver) throw { mfaResolver: resolver };
      throw err;
    }
    return;
  }

  throw new Error("Password or Google sign-in required");
}
