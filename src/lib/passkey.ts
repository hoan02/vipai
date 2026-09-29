// WebAuthn helpers for the browser.
//
// The gateway sends credential options with challenge/id fields as base64url
// strings; the browser API wants ArrayBuffers. These convert in both directions
// and normalise the created credential back into the JSON the gateway expects.
//
// Adapted from new-api's `lib/passkey`, trimmed to the registration path the
// dashboard uses.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function base64UrlToArrayBuffer(value?: string | null): ArrayBuffer {
  if (!value) return new ArrayBuffer(0);
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

export function arrayBufferToBase64Url(buffer?: ArrayBuffer | ArrayBufferLike | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll(/=+$/g, "");
}

/** Normalises the gateway's creation options into what `credentials.create` wants. */
export function prepareCredentialCreationOptions(payload: any): PublicKeyCredentialCreationOptions {
  const options =
    payload?.publicKey ?? payload?.PublicKey ?? payload?.response ?? payload?.Response ?? payload;
  if (!options) throw new Error("Could not read the passkey registration options.");

  const publicKey: PublicKeyCredentialCreationOptions & Record<string, any> = {
    ...options,
    challenge: base64UrlToArrayBuffer(options.challenge),
    user: { ...options.user, id: base64UrlToArrayBuffer(options.user?.id) },
  };

  if (Array.isArray(options.excludeCredentials)) {
    publicKey.excludeCredentials = options.excludeCredentials.map((item: any) => ({
      ...item,
      id: base64UrlToArrayBuffer(item.id),
    }));
  }
  if (Array.isArray(options.attestationFormats) && options.attestationFormats.length === 0) {
    delete publicKey.attestationFormats;
  }
  return publicKey;
}

/** Shapes the created credential into the JSON the gateway's finish call takes. */
export function buildRegistrationResult(
  credential: PublicKeyCredential | null,
): Record<string, any> | null {
  if (!credential) return null;
  const response = credential.response as AuthenticatorAttestationResponse & {
    getTransports?: () => string[];
  };
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      transports: typeof response.getTransports === "function" ? response.getTransports() : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
  };
}

/** Whether this browser exposes the WebAuthn entry point at all. */
export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
}

/** Runs the browser's credential creation prompt. */
export function createCredential(options: PublicKeyCredentialCreationOptions) {
  return navigator.credentials.create({ publicKey: options });
}
