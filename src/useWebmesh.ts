import { Ref, ref } from 'vue';
import { PromiseClient } from '@connectrpc/connect';
import { AppDaemon } from '@webmeshproject/api/v1/app_connect';
import { WebmeshOptions } from './options';

// WebmeshContext is the context for using Webmesh.
export interface WebmeshContext {
    // Client is the underlying client to the daemon.
    client: PromiseClient<typeof AppDaemon>;
    // Error is the last error that occurred.
    error: Ref<Error | null>;
}

// useWebmesh returns a WebmeshContext.
export function useWebmesh(opts: WebmeshOptions): WebmeshContext {
    if (!opts) {
        opts = WebmeshOptions.default();
    }
    const client = opts.client();
    const error = ref<Error | null>(null);
    return {
        client,
        error,
    } as WebmeshContext;
}
