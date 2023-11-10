import {
    ConnectResponse,
    GetConnectionResponse,
    DaemonConnStatus,
} from '@webmeshproject/api/v1/app_pb';
import { MeshNodes } from '@webmeshproject/api/utils/rpcdb';
import { DaemonClient } from './options';

// Connection is a webmesh connection.
export class Connection {
    public connected: boolean;
    public connectionDetails: ConnectResponse | null;

    constructor(
        public client: DaemonClient,
        public id: string,
        public details: GetConnectionResponse,
    ) {
        this.connected = details.status === DaemonConnStatus.CONNECTED;
        this.connectionDetails = this.connected
            ? ({
                  nodeID: details.node?.id,
                  ipv4Address: details.node?.privateIPv4,
                  ipv6Address: details.node?.privateIPv6,
                  ipv4Network: details.ipv4Network,
                  ipv6Network: details.ipv6Network,
                  meshDomain: details.domain,
              } as ConnectResponse)
            : null;
    }

    // nodeID returns the node ID of the connection.
    public get nodeID(): string {
        return this.connectionDetails?.nodeID || '';
    }

    // ipv4Address returns the IPv4 address of the connection.
    public get ipv4Address(): string {
        return this.connectionDetails?.ipv4Address || '';
    }

    // ipv6Address returns the IPv6 address of the connection.
    public get ipv6Address(): string {
        return this.connectionDetails?.ipv6Address || '';
    }

    // ipv4Network returns the IPv4 network of the connection.
    public get ipv4Network(): string {
        return this.connectionDetails?.ipv4Network || '';
    }

    // ipv6Network returns the IPv6 network of the connection.
    public get ipv6Network(): string {
        return this.connectionDetails?.ipv6Network || '';
    }

    // domain returns the domain of the connection.
    public get domain(): string {
        return this.connectionDetails?.meshDomain || '';
    }

    // fqdn returns the fully qualified domain name of the connection.
    public get fqdn(): string {
        return this.nodeID + '.' + this.domain;
    }

    // peers returns an interface for querying the peers of this connection.
    public get peers(): MeshNodes {
        return new MeshNodes(this.client, this.id);
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
        if (!this.connected) {
            return Promise.reject(new Error('not connected'));
        }
        return new Promise((resolve, reject) => {
            this.client
                .disconnect({ id: this.id })
                .then(() => {
                    this.connected = false;
                    this.connectionDetails = null;
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
            }
            this.client
                .dropConnection({ id: this.id })
                .then(() => {
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }
}
