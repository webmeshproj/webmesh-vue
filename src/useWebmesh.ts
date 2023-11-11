import { Ref, ref, toValue, watchEffect, onUnmounted } from 'vue';
import {
    GetConnectionResponse,
    PutConnectionResponse,
    DaemonConnStatus,
    ListConnectionsResponse,
} from '@webmeshproject/api/v1/app_pb';
import { InterfaceMetrics } from '@webmeshproject/api/v1/node_pb';
import { DaemonClient, Parameters, Options } from './options';
import { Network } from './network';

// Context is the context for using Webmesh.
export interface Context {
    // Client is the underlying client to the daemon.
    client: Ref<DaemonClient>;
    // Networks is a reference to the current list of networks.
    networks: Ref<Array<Network>>;
    // Error is a reference to the last error that occurred.
    error: Ref<Error | null>;
    // ListNetworks lists the current registered networks.
    // It also forces an update of the networks reference.
    listNetworks(): Promise<Array<Network>>;
    // PutNetwork stores the parameters for a connection to a network.
    putNetwork(opts: Parameters): Promise<Network>;
    // GetNetwork returns the network connection with the given ID.
    // It is a convenience method for finding a connection in the
    // networks reference.
    getNetwork(id: string): Promise<Network>;
    // Connect creates a new connection to a network. If no ID is given
    // or it doesn't exist, it will first be registered with the daemon.
    // Parameters or metadata will always be updated first if provided.
    // If params and meta are empty and an existing connection with the
    // given ID does not already exist, it will be rejected.
    connect(opts: Parameters): Promise<Network>;
    // Disconnect disconnects the given connection.
    disconnect(id: string): Promise<void>;
    // Drop disconnects and deletes all data for the connection with the given ID.
    drop(id: string): Promise<void>;
    // Metrics returns a reference to interface metrics that will be updated until
    // the component is unmounted.
    metrics(id: string): Ref<InterfaceMetrics | null>;
}

// useWebmesh returns a WebmeshContext.
export function useWebmesh(opts?: Options | Ref<Options>): Context {
    const client = ref({} as DaemonClient);
    const networks = ref<Array<Network>>([]);
    const error = ref<Error | null>(null);

    const upsertNetwork = (conn: Network) => {
        const i = networks.value.findIndex((c) => c.id === conn.id);
        if (i >= 0) {
            networks.value.splice(i, 1, conn);
        } else {
            networks.value.push(conn);
        }
    };

    const removeNetwork = (id: string) => {
        const i = networks.value.findIndex((c) => c.id === id);
        if (i >= 0) {
            networks.value.splice(i, 1);
        }
    };

    const listNetworks = (): Promise<Array<Network>> => {
        return new Promise((resolve, reject) => {
            const data = new Array<Network>();
            client.value
                .listConnections({})
                .then((resp: ListConnectionsResponse) => {
                    for (const [id, conn] of Object.entries(resp.connections)) {
                        const c = new Network(client.value, id, conn);
                        data.push(c);
                    }
                    networks.value = data;
                    resolve(data);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    };

    const putNetwork = (params: Parameters): Promise<Network> => {
        return new Promise((resolve, reject) => {
            client.value
                .putConnection({
                    id: params.id,
                    parameters: params.params,
                    metadata: params.meta,
                })
                .then((res: PutConnectionResponse) => {
                    const conn = new Network(client.value, res.id, {
                        status: DaemonConnStatus.DISCONNECTED,
                        parameters: params.params,
                        metadata: params.meta,
                    } as GetConnectionResponse);
                    upsertNetwork(conn);
                    resolve(conn);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    };

    const getNetwork = (id: string): Promise<Network> => {
        return new Promise((resolve, reject) => {
            const conn = networks.value.find((c) => c.id === id);
            if (!conn) {
                reject(new Error(`connection ${id} not found`));
                return;
            }
            resolve(conn as Network);
        });
    };

    const connect = (params: Parameters): Promise<Network> => {
        return new Promise((resolve, reject) => {
            if (params.meta || params.params) {
                putNetwork(params)
                    .then((conn: Network) => {
                        conn.connect()
                            .then(() => resolve(conn))
                            .catch((err: Error) => {
                                reject(err);
                            });
                    })
                    .catch((err: Error) => {
                        reject(err);
                    });
            } else if (params.id) {
                getNetwork(params.id)
                    .then((conn: Network) => {
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
                reject(new Error('no connection parameters provided'));
            }
        });
    };

    const disconnect = (id: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            getNetwork(id)
                .then((conn: Network) => {
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
            getNetwork(id)
                .then((conn: Network) => {
                    conn.drop()
                        .then(() => resolve())
                        .catch((err: Error) => {
                            reject(err);
                        });
                })
                .catch((err: Error) => reject(err))
                .finally(() => {
                    removeNetwork(id);
                });
        });
    };

    const metrics = (id: string): Ref<InterfaceMetrics | null> => {
        const ifacemetrics = ref<InterfaceMetrics | null>(null);
        const conn = networks.value.find((c) => c.id === id);
        if (!conn) {
            throw new Error(`connection ${id} not found`);
        }
        const interval = setInterval(() => {
            conn.metrics()
                .then((metrics: InterfaceMetrics) => {
                    ifacemetrics.value = metrics;
                })
                .catch((err: Error) => {
                    error.value = err;
                });
        }, 3000);
        onUnmounted(() => {
            clearInterval(interval);
        });
        return ifacemetrics as Ref<InterfaceMetrics | null>;
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
        listNetworks().catch((err: Error) => {
            error.value = err;
        });
        interval = setInterval(() => {
            listNetworks().catch((err: Error) => {
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
        networks,
        error,
        listNetworks,
        putNetwork,
        getNetwork,
        connect,
        disconnect,
        drop,
        metrics,
    } as Context;
}
