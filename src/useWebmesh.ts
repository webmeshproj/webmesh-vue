import { Ref, ref, toValue, watchEffect } from 'vue';
import { DaemonClient, WebmeshOptions } from './options';

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

// Connections is the interface for managing webmesh connections.
export class Connections {
    constructor(private client: DaemonClient) {}
};

// Connection is a webmesh connection.
export class Connection {
    constructor(private client: DaemonClient, private connectionID: string) {}
};

// useWebmesh returns a WebmeshContext.
export function useWebmesh(opts: WebmeshOptions | Ref<WebmeshOptions>): WebmeshContext {
    if (!opts) {
        opts = WebmeshOptions.default();
    }
    const client = ref(toValue(opts).client());
    const connections = ref(new Connections(client.value));
    const error = ref(null);

    const updateClient = () => {
        client.value = toValue(opts).client();
        connections.value = new Connections(client.value);
    }
    watchEffect(() => {
        updateClient();
    });

    return {
        client,
        connections,
        error,
    } as WebmeshContext;
}
