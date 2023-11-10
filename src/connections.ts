import { DaemonClient } from './options';
import { ConnectResponse } from '@webmeshproject/api/v1/app_pb';
import { MeshNodes } from '@webmeshproject/api/utils/rpcdb';

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

    // nodeID returns the node ID of the connection.
    public get nodeID(): string {
        return this.connectionDetails.nodeID;
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
        return this.nodeID + '.' + this.domain;
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
