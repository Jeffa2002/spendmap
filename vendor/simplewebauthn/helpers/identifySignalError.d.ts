import { WebAuthnError } from './webAuthnError.js';
import type { SendSignalAllAcceptedCredentialsOpts, SendSignalCurrentUserDetailsOpts, SendSignalUnknownCredentialOpts } from '../methods/sendSignal.js';
/**
 * Attempt to intuit _why_ an error was raised after calling one of the WebAuthn Signal APIs
 */
export declare function identifySignalError({ error, options }: {
    error: Error;
    options: SendSignalUnknownCredentialOpts | SendSignalAllAcceptedCredentialsOpts | SendSignalCurrentUserDetailsOpts;
}): WebAuthnError;
//# sourceMappingURL=identifySignalError.d.ts.map