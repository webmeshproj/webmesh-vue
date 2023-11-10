import { Ref, ref, toValue, watchEffect } from 'vue';
import { DaemonClient, WebmeshOptions } from './options';
import { ConnectResponse } from '@webmeshproject/api/v1/app_pb';
import { MeshNodes } from '@webmeshproject/api/utils/rpcdb';

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
    const createClient = () => {
        let current = toValue(opts);
        if (!current) {
            current = WebmeshOptions.default();
        }
        client.value = current.client();
        connections.value = new Connections(current.client());
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

// Connections is the interface for managing webmesh connections.
export class Connections {
    constructor(private client: DaemonClient) {}
}

// Connection is a webmesh connection.
export class Connection {
    constructor(
        private client: DaemonClient,
        private connectionDetails: ConnectResponse,
    ) {}

    // id returns the ID of the connection.
    public get id(): string {
        return this.connectionDetails.id;
    }

    // ipv4Address returns the IPv4 address of the connection.
    public get ipv4Address(): string {
        return this.connectionDetails.ipv4Address;
    }

    // ipv6Address returns the IPv6 address of the connection.
    public get ipv6Address(): string {
        return this.connectionDetails.ipv6Address;
    }

    // ipv4Network returns the IPv4 network of the connection.
    public get ipv4Network(): string {
        return this.connectionDetails.ipv4Network;
    }

    // ipv6Network returns the IPv6 network of the connection.
    public get ipv6Network(): string {
        return this.connectionDetails.ipv6Network;
    }

    // domain returns the domain of the connection.
    public get domain(): string {
        return this.connectionDetails.meshDomain;
    }

    // fqdn returns the fully qualified domain name of the connection.
    public get fqdn(): string {
        return this.id + '.' + this.domain;
    }

    // peers returns an interface for querying the peers of this connection.
    public get peers(): MeshNodes {
        return new MeshNodes(this.client, this.id);
    }

    // connect connects to the connection.
    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client
                .connect({ id: this.id })
                .then((res: ConnectResponse) => {
                    this.connectionDetails = res;
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    // disconnect disconnects from the connection.
    public disconnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client
                .disconnect({ id: this.id })
                .then(() => resolve())
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }
}
