import { Ref, ref, toValue, watchEffect, onUnmounted } from 'vue';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import {
    GetConnectionResponse,
    PutConnectionResponse,
    DaemonConnStatus,
    DaemonStatus,
    ListConnectionsResponse,
} from '@webmeshproject/api/v1/app_pb';
import {
    Network,
    NetworkParameters,
    Parameters,
    Metrics,
} from '@webmeshproject/api/utils/networks';
import {
    DaemonClient,
    Options,
    DefaultNamespace,
    DefaultDaemonAddress,
} from '@webmeshproject/api/utils/daemon';

/**
 * DaemonOptions are options for connecting to a daemon process.
 */
export class DaemonOptions extends Options {
    constructor(opts?: Partial<DaemonOptions>) {
        if (!opts) {
            opts = Options.default();
        }
        opts.transport = createGrpcWebTransport({
            baseUrl: opts.daemonAddress || DefaultDaemonAddress,
            interceptors: [
                Options.interceptor(opts.namespace || DefaultNamespace),
            ],
        });
        super(opts);
    }
}

/**
 * Context is the context for a Webmesh component.
 */
export interface Context {
    /**
     * client is a reference to the current daemon client.
     */
    client: Ref<DaemonClient>;
    /**
     * networks is a reference to the current list of networks.
     */
    networks: Ref<Array<Network>>;
    /**
     * error is a reference to the current error.
     */
    error: Ref<Error | null>;
    /**
     * daemonStatus returns the current status of the daemon.
     */
    daemonStatus(): Promise<DaemonStatus>;
    /**
     * listNetworks returns the current list of networks.
     */
    listNetworks(): Promise<Array<Network>>;
    /**
     * putNetwork creates a new network connection.
     */
    putNetwork(opts: NetworkParameters): Promise<Network>;
    /**
     * getNetwork returns the network connection with the given ID.
     * It is a convenience method for finding and refreshing the status
     * of a network.
     */
    getNetwork(id: string): Promise<Network>;
    /**
     * DropNetwork disconnects and deletes all data for the connection with the given ID.
     */
    dropNetwork(id: string): Promise<void>;
    /**
     * connect creates a new connection to a network. It is semantically equivalent to
     * calling PutNetwork followed by Connect on the returned network. If no parameters
     * are given, the connection with the given ID is connected.
     */
    connect(opts: Parameters): Promise<Network>;
    /**
     * disconnect disconnects the network with the given ID.
     */
    disconnect(id: string): Promise<void>;
    /**
     * deviceMetrics returns a reference to the current device metrics for the network
     * with the given ID. If pollInterval is provided, the metrics will be polled at
     * the given interval, otherwise it defaults to a 5 second interval. The polling
     * will stop when the component is unmounted.
     */
    deviceMetrics(id: string, pollInterval?: number): Ref<Metrics | null>;
}

/**
 * useWebmesh returns a context for a Webmesh component.
 */
export function useWebmesh(opts?: DaemonOptions | Ref<DaemonOptions>): Context {
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
            client.value
                .getConnection({ id: id })
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
                            resolve();
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

    const deviceMetrics = (
        id: string,
        pollInterval?: number,
    ): Ref<Metrics | null> => {
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
            current = new DaemonOptions();
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
