import { FileSystem, FileType } from 'sourcegraph'
import { createProxyAndHandleRequests } from '../../common/proxy'
import { URI } from '../../extension/types/uri'
import { Connection } from '../../protocol/jsonrpc2/connection'

/** @internal */
export interface ClientFileSystemAPI {
    $readDirectory(uri: string): Promise<[string, FileType][]>
    $readFile(uri: string): Promise<Uint8Array>
}

/** @internal */
export class ClientFileSystem {
    constructor(connection: Connection, private getFileSystem: (uri: string) => FileSystem) {
        createProxyAndHandleRequests('fileSystem', connection, this)
    }

    public $readDirectory(uri: string): Promise<[string, FileType][]> {
        return this.getFileSystem(uri).readDirectory(new URI(uri))
    }

    public $readFile(uri: string): Promise<Uint8Array> {
        return this.getFileSystem(uri).readFile(new URI(uri))
    }

    public unsubscribe(): void {
        // noop
    }
}
