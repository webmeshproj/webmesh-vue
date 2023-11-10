import { Ref, ref } from 'vue';
import { PartialMessage, Struct } from '@bufbuild/protobuf';
import { ConnectResponse, ConnectionParameters, GetConnectionResponse, PutConnectionResponse, DaemonConnStatus, ListConnectionsResponse } from '@webmeshproject/api/v1/app_pb';
import { MeshNodes } from '@webmeshproject/api/utils/rpcdb';
import { DaemonClient } from './options';

// Connections is the interface for managing webmesh connections.
export class ConnectionManager {
    constructor(public client: DaemonClient) {}

    public get(id: string): Promise<Connection> {
        return new Promise((resolve, reject) => {
            this.client
                .getConnection({ id: id })
                .then((res: GetConnectionResponse) => {
                    resolve(new Connection(this.client, id, res));
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public put(id: string, params: ConnectionParameters, meta?: PartialMessage<Struct>): Promise<Connection> {
        return new Promise((resolve, reject) => {
            this.client
                .putConnection({
                    id: id,
                    parameters: params,
                    metadata: meta,
                })
                .then((res: PutConnectionResponse) => {
                    resolve(new Connection(this.client, res.id, {
                        status: DaemonConnStatus.DISCONNECTED,
                        parameters: params,
                        metadata: meta,
                    } as GetConnectionResponse));
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public delete(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client
                .dropConnection({ id: id })
                .then(() => {
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        })
    }

    public list(): Promise<Array<Connection>> {
        return new Promise((resolve, reject) => {
            const connections = new Array<Connection>();
            this.client
                .listConnections({})
                .then((resp: ListConnectionsResponse) => {
                    for (const [id, conn] of Object.entries(resp.connections)) {
                        const c = new Connection(this.client, id, conn);
                        connections.push(c);
                    }
                    resolve(connections);
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }
}

// Connection is a webmesh connection.
export class Connection {
    public connected: boolean;
    public connectionDetails: ConnectResponse | null;

    constructor(
        public client: DaemonClient,
        public id: string,
        public details: GetConnectionResponse,
    ) {
        this.connected = false;
        this.connectionDetails = null;
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
}
