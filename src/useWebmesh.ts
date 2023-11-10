import { Ref, ref, toValue, watchEffect, onUnmounted } from 'vue';
import { DaemonClient, WebmeshOptions } from './options';
import { Connection, ConnectionManager } from './connections';

// WebmeshContext is the context for using Webmesh.
export interface WebmeshContext {
    // Client is the underlying client to the daemon.
    client: Ref<DaemonClient>;
    // Connections is the interface for managing webmesh connections.
    connectionManager: Ref<ConnectionManager>;
    // Connections is a ref to the current list of connections.
    connections: Ref<Array<Ref<Connection>>>;
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
    const connectionManager = ref(new ConnectionManager(client));
    const connections = ref<Array<Ref<Connection>>>([]);
    const error = ref<Error | null>(null);

    let interval: NodeJS.Timeout;
    const newClient = () => {
        if (interval) {
            clearInterval(interval);
        }
        let current = toValue(opts);
        if (!current) {
            current = WebmeshOptions.default();
        }
        client.value = current.client().value;
        connectionManager.value = new ConnectionManager(current.client());
        setInterval(() => {
            connectionManager.value.list().then((conns: Array<Ref<Connection>>) => {
                connections.value = conns ;
            }).catch((err: Error) => {
                error.value = err;
            });
        })
    };
    const connect = (connectionID: string): Promise<Connection> => {
        return new Promise((resolve, reject) => {
            connectionManager.value.get(connectionID)
            .then((connection: Connection) => {
                connection.connect().then(() => {
                    resolve(connection);
                }).catch((err: Error) => {
                    reject(err);
                });
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
        newClient();
    });
    onUnmounted(() => {
        if (interval) {
            clearInterval(interval);
        }
    })
    return {
        client,
        connectionManager,
        connections,
        connect,
        disconnect,
        error,
    } as WebmeshContext;
}
