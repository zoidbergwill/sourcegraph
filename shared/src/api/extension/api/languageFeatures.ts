import { from, Observable, ObservableInput, of, Unsubscribable } from 'rxjs'
import { concatMap, map, tap } from 'rxjs/operators'
import {
    DefinitionProvider,
    DocumentSelector,
    ExternalReferenceProvider,
    HoverProvider,
    ImplementationProvider,
    Location,
    ProviderResult,
    ReferenceContext,
    ReferenceProvider,
    TypeDefinitionProvider,
} from 'sourcegraph'
import { ClientLanguageFeaturesAPI } from '../../client/api/languageFeatures'
import * as plain from '../../protocol/plainTypes'
import { ProviderMap } from './common'
import { ExtDocuments } from './documents'
import { fromHover, fromLocation, toPosition } from './types'

/** @internal */
export interface ExtLanguageFeaturesAPI {
    $provideHover(id: number, resource: string, position: plain.Position): Observable<plain.Hover | null | undefined>
    $provideDefinition(id: number, resource: string, position: plain.Position): Observable<plain.Definition | undefined>
    $provideTypeDefinition(
        id: number,
        resource: string,
        position: plain.Position
    ): Observable<plain.Definition | undefined>
    $provideImplementation(
        id: number,
        resource: string,
        position: plain.Position
    ): Observable<plain.Definition | undefined>
    $provideReferences(
        id: number,
        resource: string,
        position: plain.Position,
        context: ReferenceContext
    ): Observable<plain.Location[] | null | undefined>
    $provideExternalReferences(
        id: number,
        resource: string,
        position: plain.Position,
        context: ReferenceContext
    ): Observable<plain.Location[] | null | undefined>
}

/**
 * Converts a result from a provider to an Observable.
 */
function providerResultToObservable<T>(r: ProviderResult<T>): ObservableInput<T | null | undefined> {
    // TODO write tests
    if (!r || !('subscribe' in (r as any) || 'then' in (r as any))) {
        return of(r as null | undefined)
    } else if ('subscribe' in (r as any)) {
        return r as ObservableInput<T | null | undefined>
    } else {
        return r as Promise<T | null | undefined>
    }
}

/** @internal */
export class ExtLanguageFeatures implements ExtLanguageFeaturesAPI {
    private registrations = new ProviderMap<
        | HoverProvider
        | DefinitionProvider
        | TypeDefinitionProvider
        | ImplementationProvider
        | ReferenceProvider
        | ExternalReferenceProvider
    >(id => this.proxy.$unregister(id))

    constructor(private proxy: ClientLanguageFeaturesAPI, private documents: ExtDocuments) {}

    public $provideHover(
        id: number,
        resource: string,
        position: plain.Position
    ): Observable<plain.Hover | null | undefined> {
        const provider = this.registrations.get<HoverProvider>(id)
        const x = this.documents.getSync(resource)
        console.log('should concatMap')
        return from(x).pipe(
            concatMap(doc => {
                console.log('concatMap')
                return providerResultToObservable(provider.provideHover(doc, toPosition(position)))
            }),
            map(result => (result ? fromHover(result) : result))
        )
    }

    public registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Unsubscribable {
        const { id, subscription } = this.registrations.add(provider)
        this.proxy.$registerHoverProvider(id, selector)
        return subscription
    }

    public $provideDefinition(
        id: number,
        resource: string,
        position: plain.Position
    ): Observable<plain.Definition | null | undefined> {
        const provider = this.registrations.get<DefinitionProvider>(id)
        return from(this.documents.getSync(resource)).pipe(
            concatMap(doc => providerResultToObservable(provider.provideDefinition(doc, toPosition(position)))),
            map(toDefinition)
        )
    }

    public registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Unsubscribable {
        const { id, subscription } = this.registrations.add(provider)
        this.proxy.$registerDefinitionProvider(id, selector)
        return subscription
    }

    public $provideTypeDefinition(
        id: number,
        resource: string,
        position: plain.Position
    ): Observable<plain.Definition | null | undefined> {
        const provider = this.registrations.get<TypeDefinitionProvider>(id)
        return from(this.documents.getSync(resource)).pipe(
            concatMap(doc => providerResultToObservable(provider.provideTypeDefinition(doc, toPosition(position)))),
            map(toDefinition)
        )
    }

    public registerTypeDefinitionProvider(
        selector: DocumentSelector,
        provider: TypeDefinitionProvider
    ): Unsubscribable {
        const { id, subscription } = this.registrations.add(provider)
        this.proxy.$registerTypeDefinitionProvider(id, selector)
        return subscription
    }

    public $provideImplementation(
        id: number,
        resource: string,
        position: plain.Position
    ): Observable<plain.Definition | undefined> {
        const provider = this.registrations.get<ImplementationProvider>(id)
        return from(this.documents.getSync(resource)).pipe(
            concatMap(doc => providerResultToObservable(provider.provideImplementation(doc, toPosition(position)))),
            map(toDefinition)
        )
    }

    public registerImplementationProvider(
        selector: DocumentSelector,
        provider: ImplementationProvider
    ): Unsubscribable {
        const { id, subscription } = this.registrations.add(provider)
        this.proxy.$registerImplementationProvider(id, selector)
        return subscription
    }

    public $provideReferences(
        id: number,
        resource: string,
        position: plain.Position,
        context: ReferenceContext
    ): Observable<plain.Location[] | null | undefined> {
        const provider = this.registrations.get<ReferenceProvider>(id)
        return from(this.documents.getSync(resource)).pipe(
            concatMap(doc =>
                providerResultToObservable(provider.provideReferences(doc, toPosition(position), context))
            ),
            map(toLocations)
        )
    }

    public registerReferenceProvider(selector: DocumentSelector, provider: ReferenceProvider): Unsubscribable {
        const { id, subscription } = this.registrations.add(provider)
        this.proxy.$registerReferenceProvider(id, selector)
        return subscription
    }

    public $provideExternalReferences(
        id: number,
        resource: string,
        position: plain.Position,
        context: ReferenceContext
    ): Observable<plain.Location[] | null | undefined> {
        const provider = this.registrations.get<ExternalReferenceProvider>(id)
        return from(this.documents.getSync(resource)).pipe(
            concatMap(doc =>
                providerResultToObservable(provider.provideExternalReferences(doc, toPosition(position), context))
            ),
            map(toLocations)
        )
    }

    public registerExternalReferenceProvider(
        selector: DocumentSelector,
        provider: ExternalReferenceProvider
    ): Unsubscribable {
        const { id, subscription } = this.registrations.add(provider)
        this.proxy.$registerExternalReferenceProvider(id, selector)
        return subscription
    }
}

function toLocations(result: Location[] | null | undefined): plain.Location[] | null | undefined {
    return result ? result.map(location => fromLocation(location)) : result
}

function toDefinition(result: Location[] | Location | null | undefined): plain.Definition | undefined {
    return result
        ? Array.isArray(result)
            ? result.map(location => fromLocation(location))
            : fromLocation(result)
        : result
}
