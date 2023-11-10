import { Ref, ref, toValue, watchEffect } from 'vue';
import { ConnectResponse } from '@webmeshproject/api/v1/app_pb';
import { DaemonClient, WebmeshOptions } from './options';
import { Connection, Connections } from './connections';

// WebmeshContext is the context for using Webmesh.
export interface WebmeshContext {
    // Client is the underlying client to the daemon.
    client: Ref<DaemonClient>;
    // Connections is the interface for managing webmesh connections.
    connections: Ref<Connections>;
    // Connect creates a connection to the given ID.
    connect(connectionID: string): Promise<Connection>;
    // Disconnect disconnects the given connection.
    disconnect(connectionID: string): Promise<void>;
    // Error is the last error that occurred.
    error: Ref<Error | null>;
}

// useWebmesh returns a WebmeshContext.
export function useWebmesh(
    opts: WebmeshOptions | Ref<WebmeshOptions>,
): WebmeshContext {
    const client = ref({} as DaemonClient);
    const connections = ref(new Connections(client.value));
    const error = ref(null);
    const createClient = () => {
        let current = toValue(opts);
        if (!current) {
            current = WebmeshOptions.default();
        }
        client.value = current.client();
        connections.value = new Connections(current.client());
    };
    const connect = (connectionID: string): Promise<Connection> => {
        return new Promise((resolve, reject) => {
            client.value
                .connect({ id: connectionID })
                .then((res: ConnectResponse) => {
                    resolve(new Connection(client.value, res));
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    };
    const disconnect = (connectionID: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            client.value
                .disconnect({ id: connectionID })
                .then(() => resolve())
                .catch((err: Error) => {
                    reject(err);
                });
        });
    };
    watchEffect(() => {
        createClient();
    });
    return {
        client,
        connections,
        connect,
        disconnect,
        error,
    } as WebmeshContext;
}
