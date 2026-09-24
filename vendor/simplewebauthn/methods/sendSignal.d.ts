import type { SendSignalAllAcceptedCredentialsOpts, SendSignalCurrentUserDetailsOpts, SendSignalUnknownCredentialOpts } from '../types/index.js';
export type { SendSignalAllAcceptedCredentialsOpts, SendSignalCurrentUserDetailsOpts, SendSignalUnknownCredentialOpts, } from '../types/index.js';
/**
 * Broadcast a passkey state change on the server to the browser to enlist the browser's help
 * in propagating that change to the corresponding authenticator. This can help prevent phantom
 * credentials from being offered for use, and enable new usernames to be displayed after a
 * passkey's creation.
 *
 * Sending a signal **does not** guarantee that the signal will be received by the authenticator.
 * Signals are a "fire and forget" type of broadcast that will have browsers making a best effort
 * to propagate the signal to the relevant authenticator. See the descriptions of the various
 * signal option types for guidance on how often a signal may need to be resent for maximum
 * efficacy.
 */
export declare function sendSignal(opts: SendSignalUnknownCredentialOpts | SendSignalAllAcceptedCredentialsOpts | SendSignalCurrentUserDetailsOpts): Promise<undefined>;
//# sourceMappingURL=sendSignal.d.ts.map