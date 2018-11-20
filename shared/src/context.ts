import { Subscribable } from 'rxjs'
import { ConfigurationUpdateParams } from './api/protocol'
import { GraphQLResult } from './graphql'
import * as GQL from './graphqlschema'
import { ID, SettingsCascadeOrError } from './settings'

export type UpdateExtensionSettingsArgs =
    | { edit?: ConfigurationUpdateParams }
    | {
          extensionID: string
          // TODO: unclean api, allows 4 states (2 bools), but only 3 are valid (none/disabled/enabled)
          enabled?: boolean
          remove?: boolean
      }

/**
 * Description of the context in which extensions-client-common is running, and platform-specific hooks.
 */
export interface Context {
    /**
     * An observable that emits whenever the settings cascade changes (including when any individual subject's
     * settings change).
     */
    readonly settingsCascade: Subscribable<SettingsCascadeOrError>

    updateExtensionSettings(subject: ID, args: UpdateExtensionSettingsArgs): Subscribable<void>

    /**
     * Sends a request to the Sourcegraph GraphQL API and returns the response.
     *
     * @param request The GraphQL request (query or mutation)
     * @param variables An object whose properties are GraphQL query name-value variable pairs
     * @param mightContainPrivateInfo 🚨 SECURITY: Whether or not sending the GraphQL request to Sourcegraph.com
     * could leak private information such as repository names.
     * @return Observable that emits the result or an error if the HTTP request failed
     */
    queryGraphQL(
        request: string,
        variables?: { [name: string]: any },
        mightContainPrivateInfo?: boolean
    ): Subscribable<GraphQLResult<GQL.IQuery>>

    /**
     * Sends a batch of LSP requests to the Sourcegraph LSP gateway API and returns the result.
     *
     * @param requests An array of LSP requests (with methods `initialize`, the (optional) request, `shutdown`,
     *                 `exit`).
     * @return Observable that emits the result and then completes, or an error if the request fails. The value is
     *         an array of LSP responses.
     */
    queryLSP(requests: object[]): Subscribable<object[]>

    /**
     * Forces the currently displayed tooltip, if any, to update its contents.
     */
    forceUpdateTooltip(): void
}

/**
 * React partial props for components needing the extensions context.
 */
export interface ExtensionsContextProps {
    extensionsContext: Context
}
