import H from 'history'
import * as React from 'react'
import { Subscription } from 'rxjs'
import { ContributableMenu } from '../../../../../shared/src/api/protocol'
import { ActionsNavItems } from '../../../../../shared/src/app/actions/ActionsNavItems'
import { ControllerProps } from '../../../../../shared/src/client/controller'
import { ExtensionsProps } from '../../../../../shared/src/context'
import { ISite, IUser } from '../../../../../shared/src/graphqlschema'
import { Settings, SettingsCascadeProps, SettingsSubject } from '../../../../../shared/src/settings'
import { FileInfo } from '../../libs/code_intelligence'
import { SimpleProviderFns } from '../backend/lsp'
import { fetchCurrentUser, fetchSite } from '../backend/server'
import { OpenOnSourcegraph } from './OpenOnSourcegraph'

export interface ButtonProps {
    className: string
    style: React.CSSProperties
    iconStyle?: React.CSSProperties
}

interface CodeViewToolbarProps
    extends Partial<ExtensionsProps<SettingsSubject, Settings>>,
        Partial<ControllerProps<SettingsSubject, Settings>>,
        FileInfo {
    onEnabledChange?: (enabled: boolean) => void

    buttonProps: ButtonProps
    actionsNavItemClassProps?: {
        listClass?: string
        actionItemClass?: string
    }
    simpleProviderFns: SimpleProviderFns
    location: H.Location
}

interface CodeViewToolbarState extends SettingsCascadeProps<SettingsSubject, Settings> {
    site?: ISite
    currentUser?: IUser
}

export class CodeViewToolbar extends React.Component<CodeViewToolbarProps, CodeViewToolbarState> {
    public state: CodeViewToolbarState = {
        settingsCascade: { subjects: [], final: {} },
    }

    private subscriptions = new Subscription()

    public componentDidMount(): void {
        if (this.props.extensions) {
            this.subscriptions.add(
                this.props.extensions.context.settingsCascade.subscribe(
                    settingsCascade => this.setState({ settingsCascade }),
                    err => console.error(err)
                )
            )
        }
        this.subscriptions.add(fetchSite().subscribe(site => this.setState(() => ({ site }))))
        this.subscriptions.add(fetchCurrentUser().subscribe(currentUser => this.setState(() => ({ currentUser }))))
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
        return (
            <div
                className="code-view-toolbar"
                style={{ display: 'inline-flex', verticalAlign: 'middle', alignItems: 'center' }}
            >
                <ul className={`nav ${this.props.extensions ? 'pr-1' : ''}`}>
                    {this.props.extensionsController &&
                        this.props.extensions && (
                            <ActionsNavItems
                                menu={ContributableMenu.EditorTitle}
                                extensionsController={this.props.extensionsController}
                                extensions={this.props.extensions}
                                listClass="BtnGroup"
                                actionItemClass="btn btn-sm tooltipped tooltipped-n BtnGroup-item"
                                location={this.props.location}
                            />
                        )}
                </ul>
                {this.props.baseCommitID &&
                    this.props.baseHasFileContents && (
                        <OpenOnSourcegraph
                            label={'View File (base)'}
                            ariaLabel="View file on Sourcegraph"
                            openProps={{
                                repoPath: this.props.baseRepoPath || this.props.repoPath,
                                filePath: this.props.baseFilePath || this.props.filePath,
                                rev: this.props.baseRev || this.props.baseCommitID,
                                query: {
                                    diff: {
                                        rev: this.props.baseCommitID,
                                    },
                                },
                            }}
                            className={this.props.buttonProps.className}
                            style={this.props.buttonProps.style}
                            iconStyle={this.props.buttonProps.iconStyle}
                        />
                    )}

                {/*
                  Use a ternary here because prettier insists on changing parens resulting in this button only being rendered
                  if the condition after the || is satisfied.
                 */}
                {!this.props.baseCommitID || (this.props.baseCommitID && this.props.headHasFileContents) ? (
                    <OpenOnSourcegraph
                        label={`View File${this.props.baseCommitID ? ' (head)' : ''}`}
                        ariaLabel="View file on Sourcegraph"
                        openProps={{
                            repoPath: this.props.repoPath,
                            filePath: this.props.filePath,
                            rev: this.props.rev || this.props.commitID,
                            query: this.props.commitID
                                ? {
                                      diff: {
                                          rev: this.props.commitID,
                                      },
                                  }
                                : undefined,
                        }}
                        className={this.props.buttonProps.className}
                        style={this.props.buttonProps.style}
                        iconStyle={this.props.buttonProps.iconStyle}
                    />
                ) : null}
            </div>
        )
    }
}
