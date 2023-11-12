# webmesh-vue

Vue composables for working with a webmesh daemon.

## Installation

```bash
npm install @webmeshproject/vue
# or
yarn add @webmeshproject/vue
```

## Usage

### Managing networks

```vue
<template>
<div>
  <h1>Networks</h1>
  <ul>
    <li v-for="network in networks" :key="network.name">
      <span>{{ network.name }}</span>
      <button @click="() => removeNetwork(network.name)">Remove</button>
    </li>
  </ul>
  <form @submit.prevent="createNetwork({ id: networkName })">
    <input v-model="networkName" />
    <button type="submit">Create</button>
  </form>
</template>

<script setup>
import { NetworkParameters, useWebmesh } from '@webmeshproject/vue';

const { putNetwork, dropNetwork, networks } = useWebmesh();

const createNetwork = async (params: NetworkParameters) => {
  try {
    await putNetwork(params);
  } catch (err) {
    console.error(err)
  }
}

const removeNetwork = async (name: string) => {
  try {
    await dropNetwork(name);
  } catch (err) {
    console.error(err)
  }
}

return { networks, createNetwork, removeNetwork };
</script>
```

### Connecting and disconnecting networks

```vue
<template>
    <div>
        <div v-if="network?.connected">
            <h1>Connected to {{ network?.name }}</h1>
            <button @click="disconnectFromNetwork">Disconnect</button>
            <div>
                <h2>Metrics</h2>
                <pre>{{ metrics }}</pre>
            </div>
        </div>
        <div v-else>
            <h1>Not connected to {{ networkID }}</h1>
            <button @click="connectToNetwork">Connect</button>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { Network, useWebmesh } from '@webmeshproject/vue';

const { connect, disconnect, deviceMetrics } = useWebmesh(daemon.options);
const networkID = 'test-network';

const metrics = deviceMetrics(networkID, 3000);
const network = ref<Network | null>(null);

const connectToNetwork = async () => {
    try {
        network.value = await connect({ id: networkID });
    } catch (err) {
        console.error(err);
    }
};

const disconnectFromNetwork = async () => {
    try {
        await disconnect(networkID);
        network.value = null;
    } catch (err) {
        console.error(err);
    }
};

return { metrics, networkID, network, connectToNetwork, disconnectFromNetwork };
</script>
```
