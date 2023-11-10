import { Ref, ref, toValue, watchEffect, onUnmounted } from 'vue';
import { PartialMessage, Struct } from '@bufbuild/protobuf';
import {
    ConnectionParameters,
    GetConnectionResponse,
    PutConnectionResponse,
    DaemonConnStatus,
    ListConnectionsResponse,
} from '@webmeshproject/api/v1/app_pb';
import { DaemonClient, Options } from './options';
import { Connection } from './connections';

// Context is the context for using Webmesh.
export interface Context {
    // Client is the underlying client to the daemon.
    client: Ref<DaemonClient>;
    // Connections is a ref to the current list of connections.
    connections: Ref<Array<Connection>>;
    // Error is the last error that occurred.
    error: Ref<Error | null>;
    // ListConnections lists the current connections. It also forces an
    // update of the connections ref.
    listConnections(): Promise<Array<Connection>>;
    // PutConnection stores the parameters for a connection.
    putConnection(params: NetworkParameters): Promise<Connection>;
    // Connect creates a new connection. If no ID is given or
    // it doesn't exist, it will first be registered with the
    // daemon. If params and meta are empty and an existing
    // connection with the given ID does not already exist,
    // it will be rejected.
    connect(params: NetworkParameters): Promise<Connection>;
    // Disconnect disconnects the given connection.
    disconnect(id: string): Promise<void>;
    // Drop disconnects and deletes all data for the connection with the given ID.
    drop(id: string): Promise<void>;
}

// NetworkParameters are the parameters for creating or updating a mesh connection.
export interface NetworkParameters {
    // A unique ID for the connection. If not provided the daemon will generate one.
    id?: string;
    // The parameters for connecting to the network.
    params?: ConnectionParameters;
    // Arbitrary metadata for the connection.
    meta?: PartialMessage<Struct>;
}

// useWebmesh returns a WebmeshContext.
export function useWebmesh(opts: Options | Ref<Options>): Context {
    const client = ref({} as DaemonClient);
    const connections = ref<Array<Connection>>([]);
    const error = ref<Error | null>(null);

    const upsertConnection = (conn: Connection) => {
        const i = connections.value.findIndex((c) => c.id === conn.id);
        if (i >= 0) {
            connections.value.splice(i, 1, conn);
        } else {
            connections.value.push(conn);
        }
    };

    const removeConnection = (id: string) => {
        const i = connections.value.findIndex((c) => c.id === id);
        if (i >= 0) {
            connections.value.splice(i, 1);
        }
    };

    const listConnections = (): Promise<Array<Connection>> => {
        return new Promise((resolve, reject) => {
            const data = new Array<Connection>();
            client.value
                .listConnections({})
                .then((resp: ListConnectionsResponse) => {
                    for (const [id, conn] of Object.entries(resp.connections)) {
                        const c = new Connection(client.value, id, conn);
                        data.push(c);
                    }
                    connections.value = data;
                    resolve(data);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    };

    const putConnection = (params: NetworkParameters): Promise<Connection> => {
        return new Promise((resolve, reject) => {
            client.value
                .putConnection({
                    id: params.id,
                    parameters: params.params,
                    metadata: params.meta,
                })
                .then((res: PutConnectionResponse) => {
                    const conn = new Connection(client.value, res.id, {
                        status: DaemonConnStatus.DISCONNECTED,
                        parameters: params.params,
                        metadata: params.meta,
                    } as GetConnectionResponse);
                    upsertConnection(conn);
                    resolve(conn);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    };

    const connect = (params: NetworkParameters): Promise<Connection> => {
        return new Promise((resolve, reject) => {
            if (params.meta || params.params) {
                putConnection(params)
                    .then((conn: Connection) => {
                        conn.connect()
                            .then(() => resolve(conn))
                            .catch((err: Error) => {
                                reject(err);
                            });
                    })
                    .catch((err: Error) => {
                        reject(err);
                    });
            } else {
                const conn = connections.value.find(
                    (c) => c.id === params.id,
                ) as Connection;
                if (!conn) {
                    reject(new Error(`connection ${params.id} not found`));
                    return;
                }
                conn.connect()
                    .then(() => resolve(conn))
                    .catch((err: Error) => {
                        reject(err);
                    });
            }
        });
    };

    const getConn = (id: string): Promise<Connection> => {
        return new Promise((resolve, reject) => {
            const conn = connections.value.find(
                (c) => c.id === id,
            ) as Connection;
            if (!conn) {
                reject(new Error(`connection ${id} not found`));
                return;
            }
            resolve(conn);
        });
    };

    const disconnect = (id: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            getConn(id)
                .then((conn: Connection) => {
                    conn.disconnect()
                        .then(() => resolve())
                        .catch((err: Error) => {
                            reject(err);
                        });
                })
                .catch((err: Error) => reject(err));
        });
    };

    const drop = (id: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            getConn(id)
                .then((conn: Connection) => {
                    conn.drop()
                        .then(() => resolve())
                        .catch((err: Error) => {
                            reject(err);
                        });
                })
                .catch((err: Error) => reject(err))
                .finally(() => {
                    removeConnection(id);
                });
        });
    };

    let interval: NodeJS.Timeout;
    const newClient = () => {
        if (interval) {
            clearInterval(interval);
        }
        let current = toValue(opts);
        if (!current) {
            current = Options.default();
        }
        client.value = current.client();
        listConnections().catch((err: Error) => {
            error.value = err;
        });
        interval = setInterval(() => {
            listConnections().catch((err: Error) => {
                error.value = err;
            });
        }, 3000);
    };

    watchEffect(() => {
        newClient();
    });

    onUnmounted(() => {
        if (interval) {
            clearInterval(interval);
        }
    });

    return {
        client,
        connections,
        listConnections,
        putConnection,
        connect,
        disconnect,
        drop,
        error,
    } as Context;
}
