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
import { AppDaemon } from '@webmeshproject/api/v1/app_connect';

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
export class WebmeshOptions implements DaemonOptions {
    daemonAddress: string;
    namespace: string;

    static default(): WebmeshOptions {
        return new WebmeshOptions();
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
