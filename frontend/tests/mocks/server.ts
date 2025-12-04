/**
 * MSW server setup for testing
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create and export the server
export const server = setupServer(...handlers);
