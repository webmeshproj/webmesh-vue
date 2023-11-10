import { ref, watchEffect, toValue } from 'vue';
import { createPromiseClient } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { AppDaemon } from '@webmeshproject/api/v1/app_connect';
