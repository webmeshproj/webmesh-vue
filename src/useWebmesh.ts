import { Ref, ref, toValue, watchEffect, onUnmounted } from 'vue';
import {
    GetConnectionResponse,
    PutConnectionResponse,
    DaemonConnStatus,
    DaemonStatus,
    ListConnectionsResponse,
} from '@webmeshproject/api/v1/app_pb';
import { DaemonClient, Parameters, NetworkParameters, Options } from './options';
import { Network, Metrics } from './network';



// Context is the context for using Webmesh.
export interface Context {
    // Client is the underlying client to the daemon.
    client: Ref<DaemonClient>;
    // Networks is a reference to the current list of networks.
    networks: Ref<Array<Network>>;
    // Error is a reference to the last error that occurred.
    error: Ref<Error | null>;
    // DaemonStatus returns the status of the daemon.
    daemonStatus(): Promise<DaemonStatus>;
    // ListNetworks lists the current registered networks.
    // It also forces an update of the networks reference.
    listNetworks(): Promise<Array<Network>>;
    // PutNetwork stores the parameters for a connection to a network.
    putNetwork(opts: NetworkParameters): Promise<Network>;
    // GetNetwork returns the network connection with the given ID.
    // It is a convenience method for finding and refreshing the status
    // of a network.
    getNetwork(id: string): Promise<Network>;
    // DropNetwork disconnects and deletes all data for the connection with the given ID.
    dropNetwork(id: string): Promise<void>;
    // Connect creates a new connection to a network. It is semantically equivalent to
    // calling PutNetwork followed by Connect on the returned network. If no parameters
    // are given, the connection with the given ID is connected.
    connect(opts: Parameters): Promise<Network>;
    // Disconnect disconnects from the given network ID.
    disconnect(id: string): Promise<void>;
    // DeviceMetrics returns a reference to interface metrics that will be updated until
    // the component is unmounted.
    deviceMetrics(id: string, pollInterval?: number): Ref<Metrics | null>;
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

    const daemonStatus = (): Promise<DaemonStatus> => {
        return new Promise((resolve, reject) => {
            client.value
                .status({})
                .then((resp: DaemonStatus) => {
                    resolve(resp);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

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

    const putNetwork = (params: NetworkParameters): Promise<Network> => {
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
            client.value.getConnection({ id: id })
                .then((res: GetConnectionResponse) => {
                    const conn = new Network(client.value, id, res);
                    upsertNetwork(conn);
                    resolve(conn);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    };

    const connect = (params: Parameters): Promise<Network> => {
        return new Promise((resolve, reject) => {
            if (params.meta || params.params) {
                putNetwork(params as NetworkParameters)
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

    const dropNetwork = (id: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            getNetwork(id)
                .then((conn: Network) => {
                    conn.drop()
                        .then(() => {
                            removeNetwork(id);
                            resolve()
                        })
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

    const deviceMetrics = (id: string, pollInterval?: number): Ref<Metrics | null> => {
        const ifacemetrics = ref<Metrics | null>(null);
        if (!pollInterval) {
            pollInterval = 5000;
        }
        const interval = setInterval(() => {
            const conn = networks.value.find((c) => c.id === id);
            if (!conn) {
                return;
            }
            if (!conn.connected) {
                return;
            }
            conn.metrics()
                .then((metrics: Metrics) => {
                    ifacemetrics.value = metrics;
                })
                .catch((err: Error) => {
                    error.value = err;
                });
        }, pollInterval);
        onUnmounted(() => {
            clearInterval(interval);
        });
        return ifacemetrics as Ref<Metrics | null>;
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
        }, current.pollInterval);
    };

    watchEffect(() => {
        newClient();
    });

    onUnmounted(() => {
        if (interval) {
            clearInterval(interval);
        }
    });

    newClient();

    return {
        client,
        networks,
        error,
        daemonStatus,
        listNetworks,
        putNetwork,
        getNetwork,
        connect,
        disconnect,
        dropNetwork,
        deviceMetrics,
    } as Context;
}
