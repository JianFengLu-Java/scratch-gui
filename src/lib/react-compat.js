/* eslint-disable import/no-commonjs */
const React = require('react-original');

// @shadcn/react uses the React 18 external-store hook. TurboWarp still runs
// React 16, so expose React's official compatibility shim on the shared export.
module.exports = React;
if (!React.useSyncExternalStore) {
    React.useSyncExternalStore = require('use-sync-external-store/shim').useSyncExternalStore;
}
