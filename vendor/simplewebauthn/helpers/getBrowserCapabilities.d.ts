/**
 * A helper method that wraps WebAuthn's
 * [`PublicKeyCredential.getClientCapabilities()`](https://w3c.github.io/webauthn/#sctn-getClientCapabilities)
 * feature detection method. This method includes efforts to determine a feature's availability if a
 * browser reports an "unknown" level of support for it but there exists an alternative WebAuthn API
 * that reports the feature's availability.
 *
 * Capabilities are mapped to one of the following values:
 *
 * - **supported**: The browser supports the capability
 * - **unsupported**: The browser does not support the capability
 * - **unknown**: The browser may or may not support the capability, try it and see
 *
 * **Note:** If a WebAuthn client other than the browser is handling WebAuthn API calls (e.g. a
 * password manager's browser extension) then this method will report that client's capabilities
 * instead (assuming that client has implemented `PublicKeyCredential.getClientCapabilities()`.)
 */
export declare function getBrowserCapabilities(): Promise<BrowserCapabilities>;
/**
 * One of the following values:
 *
 * - **supported**: The browser supports the corresponding capability
 * - **unsupported**: The browser does not support the corresponding capability
 * - **unknown**: The browser may or may not support the capability, try it and see
 */
export type BrowserCapabilitySupport = 'supported' | 'unsupported' | 'unknown';
/**
 * Various WebAuthn features the browser may support. See each property's description for more info.
 */
export type BrowserCapabilities = {
    /** The browser can facilitate silent passkey registration after a successful auth */
    conditionalCreate: BrowserCapabilitySupport;
    /** The browser supports autofill UI to present available passkeys */
    conditionalGet: BrowserCapabilitySupport;
    /** The browser can communicate with another device via the hybrid transport to use a passkey */
    hybridTransport: BrowserCapabilitySupport;
    /** The browser can use a local platform authenticator, or a platform authenticator available on another device via the hybrid transport  */
    passkeyPlatformAuthenticator: BrowserCapabilitySupport;
    /** The browser can use a locally available user-verifying platform authenticator */
    userVerifyingPlatformAuthenticator: BrowserCapabilitySupport;
    /** The browser can facilitate use of a passkey, bound to one RP ID, across different origins */
    relatedOrigins: BrowserCapabilitySupport;
    /** The browser supports the signal API that communicates the user's current allowed passkeys for this site */
    signalAllAcceptedCredentials: BrowserCapabilitySupport;
    /** The browser supports the signal API that communicates the user's current metadata */
    signalCurrentUserDetails: BrowserCapabilitySupport;
    /** The browser supports the signal API that communicates an invalid credential ID */
    signalUnknownCredential: BrowserCapabilitySupport;
};
export declare const _getBrowserCapabilitiesInternals: {
    stubThis: (value: BrowserCapabilities) => BrowserCapabilities;
};
//# sourceMappingURL=getBrowserCapabilities.d.ts.map