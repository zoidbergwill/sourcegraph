import { Connection } from '../protocol/jsonrpc2/connection'

/**
 * @returns A proxy that translates method calls on itself to requests sent on the {@link connection}.
 */
export function createProxyAndHandleRequests(prefix: string, connection: Connection, handler: any): any {
    handleRequests(connection, prefix, handler)
    // Need to figure out how to support Observables over the connection to
    // enable streaming external references, for example.
    //
    // Perhaps the webapp could make a request for external references with the
    // expectation that the extension running a web worker will send progress
    // notifications while it's finding external references before finally
    // responding to the original request:
    //
    // webapp ---req: externalReferences---> extension
    // webapp <---notif: ref 1--- extension
    // webapp <---notif: ref 2--- extension
    // webapp <---notif: ref ...--- extension
    // webapp <---resp: externalReferences--- extension
    //
    // Need to take a more principled approach, maybe augment the protocol with:
    //
    // - notifs: no seq no
    // - reqs: seq no
    // - observables: flag + repeated seq nos + completion message
    return createProxy((name, ...args: any[]) => connection.sendRequest(`${prefix}/${name}`, ...args))
}

/**
 * Creates a Proxy that translates method calls (whose name begins with "$") on the returned object to invocations
 * of the {@link call} function with the method name and arguments of the original call.
 */
export function createProxy(call: (name: string, args: any[]) => any): any {
    return new Proxy(Object.create(null), {
        get: (target: any, name: string) => {
            if (!target[name] && name[0] === '$') {
                target[name] = (...args: any[]) => call(name, args)
            }
            return target[name]
        },
    })
}

/**
 * Forwards all requests received on the connection to the corresponding method on the handler object. The
 * connection method `${prefix}/${name}` corresponds to the `${name}` method on the handler object. names.
 *
 * @param handler - An instance of a class whose methods should be called when the connection receives
 *                  corresponding requests.
 */
export function handleRequests(connection: Connection, prefix: string, handler: any): void {
    // A class instance's methods are own, non-enumerable properties of its prototype.
    const proto = Object.getPrototypeOf(handler)
    for (const name of Object.getOwnPropertyNames(proto)) {
        const value = proto[name]
        if (name[0] === '$' && typeof value === 'function') {
            const method = `${prefix}/${name}`

            connection.onNotification(method, (...args: any[]) => {
                console.log(args)
                value.apply(handler, args)
            })
            connection.onRequest(method, (...args: any[]) => {
                const x = value.apply(handler, args[0])
                if (x && 'subscribe' in x) {
                    console.log('yo this is an observable')
                    return new Promise((resolve, reject) =>
                        x.subscribe(
                            (y: any) => {
                                const payload = {
                                    method,
                                    args,
                                    value: y,
                                }
                                console.log('sending notif emitted', payload)
                                connection.sendNotification('languageFeatures/$observableEmitted', payload)
                            },
                            reject,
                            () => {
                                console.log('completed, resolving')
                                resolve()
                            }
                        )
                    )
                } else {
                    return x
                }
            })
        }
    }
}
