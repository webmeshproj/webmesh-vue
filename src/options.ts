import {
    Interceptor,
    PromiseClient,
    StreamRequest,
    StreamResponse,
    Transport,
    UnaryRequest,
    UnaryResponse,
    createPromiseClient,
} from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { PartialMessage, Struct } from '@bufbuild/protobuf';
import {
    ConnectionParameters,
    NetworkAuthMethod,
    MeshConnBootstrap_DefaultNetworkACL as DefaultNetworkACL,
} from '@webmeshproject/api/v1/app_pb';
import { AppDaemon } from '@webmeshproject/api/v1/app_connect';
import { Feature } from '@webmeshproject/api/v1/node_pb';

// NamespaceHeader designates the header used to specify the namespace.
const NamespaceHeader = 'x-webmesh-namespace';
// DefaultNamespace is the default namespace.
const DefaultNamespace = 'webmesh';
// DefaultDaemonAddress is the default daemon address.
const DefaultDaemonAddress = 'http://127.0.0.1:58080';

// DaemonClient is a type alias for the PromiseClient of the AppDaemon service.
export type DaemonClient = PromiseClient<typeof AppDaemon>;

// DaemonOptions are the options for communicating with the daemon.
export interface DaemonOptions {
    daemonAddress: string;
    namespace: string;
}

// WebmeshOptions are the options for using Webmesh. They are a superset of
// DaemonOptions and can be used to inherit the daemon address and namespace
// from the environment.
export class Options implements DaemonOptions {
    daemonAddress: string;
    namespace: string;

    static default(): Options {
        return new Options();
    }

    constructor(opts?: Partial<DaemonOptions>) {
        this.daemonAddress = opts?.daemonAddress ?? DefaultDaemonAddress;
        this.namespace =
            opts?.namespace ?? process.env.npm_package_name ?? DefaultNamespace;
    }

    private interceptor(): Interceptor {
        return (next) =>
            async (
                req: UnaryRequest | StreamRequest,
            ): Promise<UnaryResponse | StreamResponse> => {
                req.header.set(NamespaceHeader, this.namespace);
                return next(req);
            };
    }

    private tranport(): Transport {
        return createGrpcWebTransport({
            baseUrl: this.daemonAddress,
            interceptors: [this.interceptor()],
        });
    }

    public client(): DaemonClient {
        return createPromiseClient(AppDaemon, this.tranport());
    }
}

export type RecursiveRequired<T> = Required<{
    [P in keyof T]: T[P] extends object | undefined
      ? RecursiveRequired<Required<T[P]>>
      : T[P];
  }>;

export type NetworkParameters = RecursiveRequired<
    Partial<Parameters>
>;

// NetworkParameters are the parameters for creating or updating a mesh connection.
export interface Parameters {
    // A unique ID for the connection. If not provided the daemon will generate one.
    id?: string;
    // The parameters for connecting to the network.
    params?: ConnectionParameters;
    // Arbitrary metadata for the connection.
    meta?: PartialMessage<Struct>;
}

// Defaults are the default values for network parameters.
export class Defaults {
    static authMethod: NetworkAuthMethod = NetworkAuthMethod.NO_AUTH;
    static networkACL: DefaultNetworkACL = DefaultNetworkACL.ACCEPT;
    static meshDomain: string = 'webmesh.internal';
    static ipv4Network: string = '172.16.0.0/12';
    static listenAddress: string = '[::]:8443';
    static dnsListenUDP: string = '[::]:53';
    static dnsListenTCP: string = '[::]:53';

    static parameters(): NetworkParameters {
        return {
            id: '',
            meta: {},
            params: {
                authMethod: this.authMethod,
                authCredentials: {},
                networking: {
                    detectEndpoints: false,
                    detectPrivateEndpoints: false,
                    useDNS: false,
                },
                bootstrap: {
                    enabled: false,
                    domain: this.meshDomain,
                    ipv4Network: this.ipv4Network,
                    rbacEnabled: false,
                    defaultNetworkACL: this.networkACL,
                },
                tls: {
                    enabled: false,
                    skipVerify: false,
                    verifyChainOnly: false,
                },
                services: {
                    enabled: false,
                    listenAddress: this.listenAddress,
                    features: [] as Feature[],
                    dns: {
                        enabled: false,
                        listenUDP: this.dnsListenUDP,
                        listenTCP: this.dnsListenTCP,
                    },
                },
            },
        } as NetworkParameters;
    }
}
