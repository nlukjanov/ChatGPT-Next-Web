// stub for app/mcp/actions: the real module imports the MCP SDK, which
// ships ESM-only builds that jest cannot parse, and none of the unit
// tests exercise MCP behavior
export const getClientsStatus = jest.fn(() => Promise.resolve({}));
export const getClientTools = jest.fn(() => Promise.resolve(undefined));
export const isMcpEnabled = jest.fn(() => Promise.resolve(false));
export const getAvailableClientsCount = jest.fn(() => Promise.resolve(0));
export const getAllTools = jest.fn(() => Promise.resolve([]));
export const initializeMcpSystem = jest.fn(() => Promise.resolve(undefined));
export const executeMcpAction = jest.fn(() => Promise.resolve(undefined));
