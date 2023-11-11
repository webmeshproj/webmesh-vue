import {
    ConnectResponse,
    GetConnectionResponse,
    DaemonConnStatus,
    MetricsResponse,
} from '@webmeshproject/api/v1/app_pb';
import { InterfaceMetrics } from '@webmeshproject/api/v1/node_pb';
import { MeshNodes } from '@webmeshproject/api/utils/rpcdb';
import { DaemonClient, NetworkParameters } from './options';

// Metrics is a type alias to InterfaceMetrics for easier use with this package.
export type Metrics = InterfaceMetrics;

// Network is a connection to a webmesh network.
export class Network {
    public connected: boolean;
    public details: ConnectResponse | null;

    constructor(
        public client: DaemonClient,
        public id: string,
        public connnection: GetConnectionResponse,
    ) {
        this.connected = connnection.status === DaemonConnStatus.CONNECTED;
        this.details = this.connected
            ? ({
                  nodeID: connnection.node?.id,
                  ipv4Address: connnection.node?.privateIPv4,
                  ipv6Address: connnection.node?.privateIPv6,
                  ipv4Network: connnection.ipv4Network,
                  ipv6Network: connnection.ipv6Network,
                  meshDomain: connnection.domain,
              } as ConnectResponse)
            : null;
    }

    // params returns the parameters for the connection.
    public get params(): NetworkParameters {
        return {
            id: this.id,
            params: this.connnection.parameters || {},
            meta: this.connnection.metadata || {},
        } as NetworkParameters;
    }

    // status returns the current status of the connection.
    public get status(): DaemonConnStatus {
        return this.connnection.status;
    }

    // nodeID returns the node ID of the connection.
    public get nodeID(): string {
        return this.details?.nodeID || '';
    }

    // ipv4Address returns the IPv4 address of the connection.
    public get ipv4Address(): string {
        return this.details?.ipv4Address || '';
    }

    // ipv6Address returns the IPv6 address of the connection.
    public get ipv6Address(): string {
        return this.details?.ipv6Address || '';
    }

    // ipv4Network returns the IPv4 network of the connection.
    public get ipv4Network(): string {
        return this.details?.ipv4Network || '';
    }

    // ipv6Network returns the IPv6 network of the connection.
    public get ipv6Network(): string {
        return this.details?.ipv6Network || '';
    }

    // domain returns the domain of the connection.
    public get domain(): string {
        return this.details?.meshDomain || '';
    }

    // fqdn returns the fully qualified domain name of the connection.
    public get fqdn(): string {
        return this.connected ? this.nodeID + '.' + this.domain : '';
    }

    // peers returns an interface for querying the peers of this connection.
    public get peers(): MeshNodes {
        return new MeshNodes(this.client, this.id);
    }

    // metrics retrieves the current metrics for the connection.
    public metrics(): Promise<Metrics> {
        if (!this.connected) {
            Promise.resolve(new InterfaceMetrics());
        }
        return new Promise((resolve, reject) => {
            this.client
                .metrics({ ids: [this.id] })
                .then((res: MetricsResponse) => {
                    resolve(res.interfaces[this.id]);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    // connect connects to the connection.
    public connect(): Promise<void> {
        if (this.connected) {
            return Promise.reject(new Error('already connected'));
        }
        return new Promise((resolve, reject) => {
            this.client
                .connect({ id: this.id })
                .then((res: ConnectResponse) => {
                    this.connected = true;
                    this.details = res;
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    // disconnect disconnects from the connection.
    public disconnect(): Promise<void> {
        if (!this.connected) {
            return Promise.reject(new Error('not connected'));
        }
        return new Promise((resolve, reject) => {
            this.client
                .disconnect({ id: this.id })
                .then(() => {
                    this.connected = false;
                    this.details = null;
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    // drop drops the connection.
    public drop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                this.disconnect()
                    .then(() => {
                        this.client
                            .dropConnection({ id: this.id })
                            .then(() => {
                                resolve();
                            })
                            .catch((err: Error) => {
                                reject(err);
                            });
                    })
                    .catch((err: Error) => {
                        reject(err);
                    });
            } else {
                this.client
                    .dropConnection({ id: this.id })
                    .then(() => {
                        resolve();
                    })
                    .catch((err: Error) => {
                        reject(err);
                    });
            }
        });
    }
}
