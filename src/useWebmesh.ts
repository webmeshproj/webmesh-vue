// import { ref, watchEffect, toValue } from 'vue';
import {
    UnaryRequest,
    UnaryResponse,
    StreamRequest,
    StreamResponse,
    createPromiseClient,
} from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { AppDaemon } from '@webmeshproject/api/v1/app_connect';

const NamespaceHeader = 'x-webmesh-namespace';
const DefaultNamespace = 'webmesh';
const DefaultDaemonAddress = 'http://127.0.0.1:58080';

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
}

// WebmeshContext is the context for using Webmesh.
export interface WebmeshContext {}

// useWebmesh returns a WebmeshContext.
export function useWebmesh(opts: WebmeshOptions): WebmeshContext {
    if (!opts) {
        opts = WebmeshOptions.default();
    }
    const transport = createGrpcWebTransport({
        baseUrl: opts.daemonAddress,
        interceptors: [
            (next) =>
                async (
                    req: UnaryRequest | StreamRequest,
                ): Promise<UnaryResponse | StreamResponse> => {
                    req.header.set(NamespaceHeader, opts.namespace);
                    return next(req);
                },
        ],
    });
    const client = createPromiseClient(AppDaemon, transport);
    return {} as WebmeshContext;
}
