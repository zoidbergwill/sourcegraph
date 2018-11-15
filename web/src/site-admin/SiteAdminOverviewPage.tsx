import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import { upperFirst } from 'lodash'
import AddIcon from 'mdi-react/AddIcon'
import CityIcon from 'mdi-react/CityIcon'
import EmoticonIcon from 'mdi-react/EmoticonIcon'
import EyeIcon from 'mdi-react/EyeIcon'
import HistoryIcon from 'mdi-react/HistoryIcon'
import SettingsIcon from 'mdi-react/SettingsIcon'
import UserIcon from 'mdi-react/UserIcon'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { Observable, Subscription } from 'rxjs'
import { map } from 'rxjs/operators'
import * as GQL from '../../../shared/src/graphqlschema'
import { dataOrThrowErrors, gql, queryGraphQL } from '../backend/graphql'
import { OverviewItem, OverviewList } from '../components/Overview'
import { PageTitle } from '../components/PageTitle'
import { eventLogger } from '../tracking/eventLogger'
import { RepositoryIcon } from '../util/icons' // TODO: Switch to mdi icon
import { numberWithCommas, pluralize } from '../util/strings'
import { fetchSiteUsageStatistics } from './backend'
import { UsageChart } from './SiteAdminUsageStatisticsPage'

interface Props {
    overviewComponents: ReadonlyArray<React.ComponentType>
    isLightTheme: boolean
}

interface State {
    info?: OverviewInfo
    stats?: GQL.ISiteUsageStatistics
    error?: Error
}

/**
 * A page displaying an overview of site admin information.
 */
export class SiteAdminOverviewPage extends React.Component<Props, State> {
    public state: State = {}

    private subscriptions = new Subscription()

    public componentDidMount(): void {
        eventLogger.logViewEvent('SiteAdminOverview')

        this.subscriptions.add(fetchOverview().subscribe(info => this.setState({ info })))
        this.subscriptions.add(
            fetchSiteUsageStatistics().subscribe(stats => this.setState({ stats }), error => this.setState({ error }))
        )
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
        return (
            <div className="site-admin-overview-page">
                <PageTitle title="Overview - Admin" />
                {this.props.overviewComponents.length > 0 && (
                    <div className="mb-4">{this.props.overviewComponents.map((C, i) => <C key={i} />)}</div>
                )}
                {!this.state.info && <LoadingSpinner className="icon-inline" />}
                <OverviewList>
                    {this.state.info && (
                        <OverviewItem
                            link="/explore"
                            icon={EyeIcon}
                            actions={
                                <Link to="/explore" className="btn btn-primary btn-sm">
                                    Explore
                                </Link>
                            }
                        >
                            Explore
                        </OverviewItem>
                    )}
                    {this.state.info && (
                        <OverviewItem
                            link="/site-admin/repositories"
                            icon={RepositoryIcon}
                            actions={
                                <>
                                    <Link to="/site-admin/configuration" className="btn btn-primary btn-sm">
                                        <SettingsIcon className="icon-inline" /> Configure repositories
                                    </Link>
                                    <Link to="/site-admin/repositories" className="btn btn-secondary btn-sm">
                                        View all
                                    </Link>
                                </>
                            }
                        >
                            {numberWithCommas(this.state.info.repositories)}&nbsp;
                            {this.state.info.repositories !== null
                                ? pluralize('repository', this.state.info.repositories, 'repositories')
                                : '?'}
                        </OverviewItem>
                    )}
                    {this.state.info && (
                        <OverviewItem
                            link="/site-admin/users"
                            icon={UserIcon}
                            actions={
                                <>
                                    <Link to="/site-admin/users/new" className="btn btn-primary btn-sm">
                                        <AddIcon className="icon-inline" /> Create user account
                                    </Link>
                                    <Link to="/site-admin/configuration" className="btn btn-secondary btn-sm">
                                        <SettingsIcon className="icon-inline" /> Configure SSO
                                    </Link>
                                    <Link to="/site-admin/users" className="btn btn-secondary btn-sm">
                                        View all
                                    </Link>
                                </>
                            }
                        >
                            {numberWithCommas(this.state.info.users)}&nbsp;{pluralize('user', this.state.info.users)}
                        </OverviewItem>
                    )}
                    {this.state.info && (
                        <OverviewItem
                            link="/site-admin/organizations"
                            icon={CityIcon}
                            actions={
                                <>
                                    <Link to="/organizations/new" className="btn btn-primary btn-sm">
                                        <AddIcon className="icon-inline" /> Create organization
                                    </Link>
                                    <Link to="/site-admin/organizations" className="btn btn-secondary btn-sm">
                                        View all
                                    </Link>
                                </>
                            }
                        >
                            {numberWithCommas(this.state.info.orgs)}&nbsp;{pluralize(
                                'organization',
                                this.state.info.orgs
                            )}
                        </OverviewItem>
                    )}
                    {this.state.info && (
                        <OverviewItem
                            link="/site-admin/surveys"
                            icon={EmoticonIcon}
                            actions={
                                <>
                                    <Link to="/site-admin/surveys" className="btn btn-secondary btn-sm">
                                        View all
                                    </Link>
                                </>
                            }
                        >
                            {numberWithCommas(this.state.info.surveyResponses.totalCount)}&nbsp;{pluralize(
                                'survey response',
                                this.state.info.surveyResponses.totalCount
                            )}
                            {this.state.info.surveyResponses.totalCount >= 5 &&
                                `, ${numberWithCommas(
                                    this.state.info.surveyResponses.averageScore
                                )} average in last 30 days (from 0–10)`}
                        </OverviewItem>
                    )}
                </OverviewList>
                {this.state.error && <p className="alert alert-danger">{upperFirst(this.state.error.message)}</p>}
                {this.state.stats && (
                    <>
                        <br />
                        <UsageChart
                            {...this.props}
                            stats={this.state.stats}
                            chartID="waus"
                            className="mt-5 mb-5"
                            header={
                                <h2>
                                    Weekly unique users (<Link to="/site-admin/usage-statistics">see more</Link>)
                                </h2>
                            }
                        />
                    </>
                )}
            </div>
        )
    }
}

interface OverviewInfo {
    repositories: number | null
    users: number
    orgs: number
    surveyResponses: {
        totalCount: number
        averageScore: number
    }
}

function fetchOverview(): Observable<OverviewInfo> {
    return queryGraphQL(gql`
        query Overview {
            repositories {
                totalCount(precise: true)
            }
            users {
                totalCount
            }
            organizations {
                totalCount
            }
            surveyResponses {
                totalCount
                averageScore
            }
        }
    `).pipe(
        map(dataOrThrowErrors),
        map(data => ({
            repositories: data.repositories.totalCount,
            users: data.users.totalCount,
            orgs: data.organizations.totalCount,
            surveyResponses: data.surveyResponses,
        }))
    )
}
