import { ShortcutProvider } from '@slimsag/react-shortcuts'
import { Notifications } from '@sourcegraph/extensions-client-common/lib/app/notifications/Notifications'
import { createController as createExtensionsController } from '@sourcegraph/extensions-client-common/lib/client/controller'
import { ConfiguredExtension } from '@sourcegraph/extensions-client-common/lib/extensions/extension'
import {
    ConfigurationCascadeOrError,
    ConfigurationSubject,
    ConfiguredSubject,
    Settings,
} from '@sourcegraph/extensions-client-common/lib/settings'
import AlertCircleIcon from 'mdi-react/AlertCircleIcon'
import ServerIcon from 'mdi-react/ServerIcon'
import * as React from 'react'
import { Route } from 'react-router'
import { BrowserRouter } from 'react-router-dom'
import { combineLatest, from, Subscription } from 'rxjs'
import { startWith } from 'rxjs/operators'
import { EMPTY_ENVIRONMENT as EXTENSIONS_EMPTY_ENVIRONMENT } from 'sourcegraph/module/client/environment'
import { TextDocumentItem } from 'sourcegraph/module/client/types/textDocument'
import { authenticatedUser } from './auth'
import * as GQL from './backend/graphqlschema'
import { FeedbackText } from './components/FeedbackText'
import { HeroPage } from './components/HeroPage'
import { Tooltip } from './components/tooltip/Tooltip'
import { ExploreSectionDescriptor } from './explore/ExploreArea'
import { ExtensionsEnvironmentProps } from './extensions/environment/ExtensionsEnvironment'
import { ExtensionAreaRoute } from './extensions/extension/ExtensionArea'
import { ExtensionAreaHeaderNavItem } from './extensions/extension/ExtensionAreaHeader'
import { ExtensionsAreaRoute } from './extensions/ExtensionsArea'
import { ExtensionsAreaHeaderActionButton } from './extensions/ExtensionsAreaHeader'
import {
    ConfigurationCascadeProps,
    createMessageTransports,
    ExtensionsControllerProps,
    ExtensionsProps,
} from './extensions/ExtensionsClientCommonContext'
import { createExtensionsContextController } from './extensions/ExtensionsClientCommonContext'
import { KeybindingsProps } from './keybindings'
import { Layout, LayoutProps } from './Layout'
import { updateUserSessionStores } from './marketing/util'
import { RepoHeaderActionButton } from './repo/RepoHeader'
import { RepoRevContainerRoute } from './repo/RepoRevContainer'
import { LayoutRouteProps } from './routes'
import { SiteAdminAreaRoute } from './site-admin/SiteAdminArea'
import { SiteAdminSideBarGroups } from './site-admin/SiteAdminSidebar'
import { eventLogger } from './tracking/eventLogger'
import { UserAccountAreaRoute } from './user/account/UserAccountArea'
import { UserAccountSidebarItems } from './user/account/UserAccountSidebar'
import { UserAreaRoute } from './user/area/UserArea'
import { UserAreaHeaderNavItem } from './user/area/UserAreaHeader'
import { isErrorLike } from './util/errors'

export interface SourcegraphWebAppProps extends KeybindingsProps {
    exploreSections: ReadonlyArray<ExploreSectionDescriptor>
    extensionAreaRoutes: ReadonlyArray<ExtensionAreaRoute>
    extensionAreaHeaderNavItems: ReadonlyArray<ExtensionAreaHeaderNavItem>
    extensionsAreaRoutes: ReadonlyArray<ExtensionsAreaRoute>
    extensionsAreaHeaderActionButtons: ReadonlyArray<ExtensionsAreaHeaderActionButton>
    siteAdminAreaRoutes: ReadonlyArray<SiteAdminAreaRoute>
    siteAdminSideBarGroups: SiteAdminSideBarGroups
    siteAdminOverviewComponents: ReadonlyArray<React.ComponentType>
    userAreaHeaderNavItems: ReadonlyArray<UserAreaHeaderNavItem>
    userAreaRoutes: ReadonlyArray<UserAreaRoute>
    userAccountSideBarItems: UserAccountSidebarItems
    userAccountAreaRoutes: ReadonlyArray<UserAccountAreaRoute>
    repoRevContainerRoutes: ReadonlyArray<RepoRevContainerRoute>
    repoHeaderActionButtons: ReadonlyArray<RepoHeaderActionButton>
    routes: ReadonlyArray<LayoutRouteProps>
}

interface SourcegraphWebAppState
    extends ConfigurationCascadeProps,
        ExtensionsProps,
        ExtensionsEnvironmentProps,
        ExtensionsControllerProps {
    error?: Error

    /** The currently authenticated user (or null if the viewer is anonymous). */
    authenticatedUser?: GQL.IUser | null

    viewerSubject: LayoutProps['viewerSubject']

    /**
     * Whether the light theme is enabled or not
     */
    isLightTheme: boolean

    /**
     * Theme checker. Set theme to light, dark, or macOS Mojave system
     */
    sourcegraphTheme: 'dark' | 'light' | 'system'

    /**
     * Whether the user is on MainPage and therefore not logged in
     */
    isMainPage: boolean

    /**
     * The current search query in the navbar.
     */
    navbarSearchQuery: string
}

const LIGHT_THEME_LOCAL_STORAGE_KEY = 'light-theme'

// TODO: Replace Light Theme code with this
const SOURCEGRAPH_THEME_LOCAL_STORAGE_KEY = 'light'

/** A fallback configuration subject that can be constructed synchronously at initialization time. */
const SITE_SUBJECT_NO_ADMIN: Pick<GQL.IConfigurationSubject, 'id' | 'viewerCanAdminister'> = {
    id: window.context.siteGQLID,
    viewerCanAdminister: false,
}

/**
 * The root component
 */
export class SourcegraphWebApp extends React.Component<SourcegraphWebAppProps, SourcegraphWebAppState> {
    constructor(props: SourcegraphWebAppProps) {
        super(props)
        const extensions = createExtensionsContextController()
        this.state = {
            isLightTheme: localStorage.getItem(LIGHT_THEME_LOCAL_STORAGE_KEY) !== 'false',
            sourcegraphTheme: 'system',
            navbarSearchQuery: '',
            configurationCascade: { subjects: null, merged: null },
            extensions,
            extensionsEnvironment: EXTENSIONS_EMPTY_ENVIRONMENT,
            extensionsController: createExtensionsController(extensions.context, createMessageTransports),
            viewerSubject: SITE_SUBJECT_NO_ADMIN,
            isMainPage: false,
        }
    }

    private subscriptions = new Subscription()

    public componentDidMount(): void {
        updateUserSessionStores()

        document.body.classList.add('theme')

        this.subscriptions.add(
            authenticatedUser.subscribe(
                authenticatedUser => this.setState({ authenticatedUser }),
                () => this.setState({ authenticatedUser: null })
            )
        )

        this.subscriptions.add(
            combineLatest(
                from(this.state.extensions.context.configurationCascade).pipe(startWith(null)),
                authenticatedUser.pipe(startWith(null))
            ).subscribe(([cascade, authenticatedUser]) => {
                this.setState(() => {
                    if (authenticatedUser) {
                        return { viewerSubject: authenticatedUser }
                    } else if (
                        cascade &&
                        !isErrorLike(cascade) &&
                        cascade.subjects &&
                        !isErrorLike(cascade.subjects) &&
                        cascade.subjects.length > 0
                    ) {
                        return { viewerSubject: cascade.subjects[0].subject }
                    } else {
                        return { viewerSubject: SITE_SUBJECT_NO_ADMIN }
                    }
                })
            })
        )

        this.subscriptions.add(this.state.extensionsController)

        this.subscriptions.add(
            this.state.extensions.context.configurationCascade.subscribe(
                v => this.onConfigurationCascadeChange(v),
                err => console.error(err)
            )
        )

        // Keep the Sourcegraph extensions controller's extensions up-to-date.
        //
        // TODO(sqs): handle loading and errors
        this.subscriptions.add(
            this.state.extensions.viewerConfiguredExtensions.subscribe(
                extensions => this.onViewerConfiguredExtensionsChange(extensions),
                err => console.error(err)
            )
        )
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            console.log("it's light")
            document.body.classList.remove('theme')
            document.body.classList.remove('theme-light')
            document.body.classList.remove('theme-dark')
            this.setState(state => ({ isLightTheme: true, sourcegraphTheme: 'system' }))
            localStorage.setItem(
                LIGHT_THEME_LOCAL_STORAGE_KEY,
                window.matchMedia('(prefers-color-scheme: light)').matches + ''
            )
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            console.log("it's dark")
            document.body.classList.remove('theme')
            document.body.classList.remove('theme-light')
            document.body.classList.remove('theme-dark')
            localStorage.setItem(
                LIGHT_THEME_LOCAL_STORAGE_KEY,
                window.matchMedia('(prefers-color-scheme: dark)').matches + ''
            )
            this.setState(state => ({ isLightTheme: false, sourcegraphTheme: 'system' }))
        } else {
            console.log("Mojave Theme Support – This ain't it chief")
            // Revert theme to light by default
            this.setState({ sourcegraphTheme: 'light' })
            localStorage.setItem(LIGHT_THEME_LOCAL_STORAGE_KEY, this.state.isLightTheme + '')
        }
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
        document.body.classList.remove('theme')
        document.body.classList.remove('theme-light')
        document.body.classList.remove('theme-dark')
    }

    public componentDidUpdate(): void {
        console.log('localstorage', localStorage.getItem(LIGHT_THEME_LOCAL_STORAGE_KEY))
        // Always show MainPage in dark theme look
        if (this.state.isMainPage && this.state.isLightTheme) {
            document.body.classList.remove('theme-light')
            document.body.classList.add('theme-dark')
        } else if (this.state.sourcegraphTheme === 'system') {
            document.body.classList.remove('theme')
            document.body.classList.remove('theme-light')
            document.body.classList.remove('theme-dark')
        } else {
            localStorage.setItem(LIGHT_THEME_LOCAL_STORAGE_KEY, this.state.isLightTheme + '')
            document.body.classList.toggle('theme-light', this.state.isLightTheme)
            console.log('Set light theme')
            document.body.classList.toggle('theme-dark', !this.state.isLightTheme)
            console.log('Set dark theme')
        }
    }

    public render(): React.ReactFragment | null {
        if (this.state.error) {
            return <HeroPage icon={AlertCircleIcon} title={'Something happened'} subtitle={this.state.error.message} />
        }

        if (window.pageError && window.pageError.statusCode !== 404) {
            const statusCode = window.pageError.statusCode
            const statusText = window.pageError.statusText
            const errorMessage = window.pageError.error
            const errorID = window.pageError.errorID

            let subtitle: JSX.Element | undefined
            if (errorID) {
                subtitle = <FeedbackText headerText="Sorry, there's been a problem." />
            }
            if (errorMessage) {
                subtitle = (
                    <div className="app__error">
                        {subtitle}
                        {subtitle && <hr />}
                        <pre>{errorMessage}</pre>
                    </div>
                )
            } else {
                subtitle = <div className="app__error">{subtitle}</div>
            }
            return <HeroPage icon={ServerIcon} title={`${statusCode}: ${statusText}`} subtitle={subtitle} />
        }

        const { authenticatedUser } = this.state
        if (authenticatedUser === undefined) {
            return null
        }

        const { children, ...props } = this.props

        return (
            <ShortcutProvider>
                <BrowserRouter key={0}>
                    <Route
                        path="/"
                        // tslint:disable-next-line:jsx-no-lambda RouteProps.render is an exception
                        render={routeComponentProps => (
                            <Layout
                                {...props}
                                {...routeComponentProps}
                                authenticatedUser={authenticatedUser}
                                viewerSubject={this.state.viewerSubject}
                                configurationCascade={this.state.configurationCascade}
                                // Theme
                                isLightTheme={this.state.isLightTheme}
                                sourcegraphTheme={this.state.sourcegraphTheme}
                                onThemeChange={this.onThemeChange}
                                useSystemTheme={this.useSystemTheme}
                                isMainPage={this.state.isMainPage}
                                onMainPage={this.onMainPage}
                                // Search query
                                navbarSearchQuery={this.state.navbarSearchQuery}
                                onNavbarQueryChange={this.onNavbarQueryChange}
                                // Extensions
                                extensions={this.state.extensions}
                                extensionsEnvironment={this.state.extensionsEnvironment}
                                extensionsOnVisibleTextDocumentsChange={this.extensionsOnVisibleTextDocumentsChange}
                                extensionsController={this.state.extensionsController}
                            />
                        )}
                    />
                </BrowserRouter>
                <Tooltip key={1} />
                <Notifications key={2} extensionsController={this.state.extensionsController} />
            </ShortcutProvider>
        )
    }

    private onThemeChange = () => {
        this.setState(
            state => ({ isLightTheme: !state.isLightTheme, sourcegraphTheme: state.isLightTheme ? 'light' : 'dark' }),
            () => {
                eventLogger.log(this.state.isLightTheme ? 'LightThemeClicked' : 'DarkThemeClicked')
            }
        )
    }
    private useSystemTheme = () => {
        console.log('windowsmatching dark: ', window.matchMedia('(prefers-color-scheme: dark)').matches)
        this.setState({
            sourcegraphTheme: 'system',
            isLightTheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? false : true,
        })
        localStorage.setItem(
            LIGHT_THEME_LOCAL_STORAGE_KEY,
            window.matchMedia('(prefers-color-scheme: dark)').matches ? 'false' : 'true'
        )
        console.log('Using systemtheme from compoent')
        eventLogger.log(this.state.sourcegraphTheme)
    }

    private onMainPage = (mainPage: boolean) => {
        this.setState(state => ({ isMainPage: mainPage }))
    }

    private onNavbarQueryChange = (navbarSearchQuery: string) => {
        this.setState({ navbarSearchQuery })
    }

    private onConfigurationCascadeChange(
        configurationCascade: ConfigurationCascadeOrError<ConfigurationSubject, Settings>
    ): void {
        this.setState(
            prevState => {
                const update: Pick<SourcegraphWebAppState, 'configurationCascade' | 'extensionsEnvironment'> = {
                    configurationCascade,
                    extensionsEnvironment: prevState.extensionsEnvironment,
                }
                if (
                    configurationCascade.subjects !== null &&
                    !isErrorLike(configurationCascade.subjects) &&
                    configurationCascade.merged !== null &&
                    !isErrorLike(configurationCascade.merged)
                ) {
                    // Only update Sourcegraph extensions environment configuration if the configuration was
                    // successfully parsed.
                    //
                    // TODO(sqs): Think through how this error should be handled.
                    update.extensionsEnvironment = {
                        ...prevState.extensionsEnvironment,
                        configuration: {
                            subjects: configurationCascade.subjects.filter(
                                (subject): subject is ConfiguredSubject<ConfigurationSubject, Settings> =>
                                    subject.settings !== null && !isErrorLike(subject.settings)
                            ),
                            merged: configurationCascade.merged,
                        },
                    }
                }
                return update
            },
            () => this.state.extensionsController.setEnvironment(this.state.extensionsEnvironment)
        )
    }

    private onViewerConfiguredExtensionsChange(viewerConfiguredExtensions: ConfiguredExtension[]): void {
        this.setState(
            prevState => ({
                extensionsEnvironment: {
                    ...prevState.extensionsEnvironment,
                    extensions: viewerConfiguredExtensions,
                },
            }),
            () => this.state.extensionsController.setEnvironment(this.state.extensionsEnvironment)
        )
    }

    private extensionsOnVisibleTextDocumentsChange = (visibleTextDocuments: TextDocumentItem[] | null): void => {
        this.setState(
            prevState => ({ extensionsEnvironment: { ...prevState.extensionsEnvironment, visibleTextDocuments } }),
            () => this.state.extensionsController.setEnvironment(this.state.extensionsEnvironment)
        )
    }
}
