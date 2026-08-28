const guiColors = {
    'color-scheme': 'light',

    'ui-primary': '#ffffff',
    'ui-secondary': '#ffffff',
    'ui-tertiary': '#e5e5e5',

    'ui-modal-overlay': 'var(--tw-dialog-overlay)',
    'ui-modal-background': 'var(--tw-dialog-background)',
    'ui-modal-foreground': 'var(--tw-dialog-foreground)',
    'ui-modal-header-background': 'var(--tw-dialog-background)',
    'ui-modal-header-foreground': 'var(--tw-dialog-foreground)',

    'ui-white': 'hsla(0, 100%, 100%, 1)', /* #FFFFFF */
    'ui-white-dim': 'hsla(0, 100%, 100%, 0.75)', /* 25% transparent version of ui-white */
    'ui-white-transparent': 'hsla(0, 100%, 100%, 0.25)', /* 25% transparent version of ui-white */
    'ui-transparent': 'hsla(0, 100%, 100%, 0)', /* 25% transparent version of ui-white */

    'ui-black-transparent': 'hsla(0, 0%, 0%, 0.15)', /* 15% transparent version of black */

    'text-primary': 'hsla(225, 15%, 40%, 1)', /* #575E75 */
    'text-primary-transparent': 'hsla(225, 15%, 40%, 0.75)',

    'motion-primary': 'hsla(215, 100%, 65%, 1)', /* #4C97FF */
    'motion-primary-transparent': 'hsla(215, 100%, 65%, 0.9)', /* 90% transparent version of motion-primary */
    'motion-tertiary': 'hsla(215, 60%, 50%, 1)', /* #3373CC */

    'looks-secondary': 'hsla(260, 60%, 60%, 1)', /* #855CD6 */
    'looks-transparent': 'hsla(260, 60%, 60%, 0.35)', /* 35% transparent version of looks-tertiary */
    'looks-light-transparent': 'hsla(260, 60%, 60%, 0.15)', /* 15% transparent version of looks-tertiary */
    'looks-secondary-dark': 'hsla(260, 42%, 51%, 1)', /* #714EB6 */

    'red-primary': 'hsla(20, 100%, 55%, 1)', /* #FF661A */
    'red-tertiary': 'hsla(20, 100%, 45%, 1)', /* #E64D00 */

    'sound-primary': 'hsla(300, 53%, 60%, 1)', /* #CF63CF */
    'sound-tertiary': 'hsla(300, 48%, 50%, 1)', /* #BD42BD */

    'control-primary': 'hsla(38, 100%, 55%, 1)', /* #FFAB19 */

    'data-primary': 'hsla(30, 100%, 55%, 1)', /* #FF8C1A */

    'pen-primary': 'hsla(163, 85%, 40%, 1)', /* #0FBD8C */
    'pen-transparent': 'hsla(163, 85%, 40%, 0.25)', /* #0FBD8C */
    'pen-tertiary': 'hsla(163, 86%, 30%, 1)', /* #0B8E69 */

    'error-primary': 'hsla(30, 100%, 55%, 1)', /* #FF8C1A */
    'error-light': 'hsla(30, 100%, 70%, 1)', /* #FFB366 */
    'error-transparent': 'hsla(30, 100%, 55%, 0.25)', /* #FF8C1A */

    'extensions-primary': 'hsla(163, 85%, 40%, 1)', /* #0FBD8C */
    'extensions-tertiary': 'hsla(163, 85%, 30%, 1)', /* #0B8E69 */
    'extensions-transparent': 'hsla(163, 85%, 40%, 0.35)', /* 35% transparent version of extensions-primary */
    'extensions-light': 'hsla(163, 57%, 85%, 1)', /* opaque version of extensions-transparent, on white bg */

    'drop-highlight': 'hsla(215, 100%, 77%, 1)', /* lighter than motion-primary */

    'menu-bar-background': 'var(--tw-topbar-background)',
    'menu-bar-background-image': 'none',
    'menu-bar-foreground': 'var(--tw-topbar-foreground)',

    'tw-topbar-background': '#ffffff',
    'tw-topbar-foreground': '#171717',
    'tw-topbar-muted': '#fafafa',
    'tw-topbar-muted-foreground': '#737373',
    'tw-topbar-border': '#e5e5e5',
    'tw-topbar-accent': '#f5f5f5',
    'tw-topbar-accent-foreground': '#171717',
    'tw-topbar-primary': '#171717',
    'tw-topbar-primary-hover': '#262626',
    'tw-topbar-primary-foreground': '#fafafa',
    'tw-topbar-ring': '#a3a3a3',
    'tw-topbar-shadow': 'rgba(23, 23, 23, 0.08)',
    'tw-menu-background': '#ffffff',
    'tw-menu-foreground': '#171717',
    'tw-menu-muted-foreground': '#737373',
    'tw-menu-border': '#e5e5e5',
    'tw-menu-accent': '#f5f5f5',
    'tw-menu-accent-foreground': '#171717',
    'tw-dialog-overlay': 'rgba(10, 10, 10, 0.48)',
    'tw-dialog-background': '#ffffff',
    'tw-dialog-foreground': '#171717',
    'tw-dialog-muted': '#fafafa',
    'tw-dialog-muted-foreground': '#737373',
    'tw-dialog-border': '#e5e5e5',
    'tw-dialog-accent': '#f5f5f5',
    'tw-dialog-accent-foreground': '#171717',
    'tw-dialog-primary': '#171717',
    'tw-dialog-primary-hover': '#262626',
    'tw-dialog-primary-foreground': '#fafafa',
    'tw-dialog-input': '#ffffff',
    'tw-dialog-ring': '#a3a3a3',
    'tw-dialog-shadow': 'rgba(23, 23, 23, 0.18)',
    'tw-dialog-destructive': '#dc2626',
    'tw-dialog-destructive-foreground': '#ffffff',
    'tw-status-neutral': '#a3a3a3',
    'tw-status-success': '#16a34a',
    'tw-status-warning': '#d97706',
    'tw-status-danger': '#dc2626',

    'assets-background': '#ffffff',

    'input-background': '#ffffff',

    'popover-background': '#ffffff',

    'shadow': 'hsla(0, 0%, 0%, 0.15)',

    'badge-background': '#dbebff',
    'badge-border': '#b9d6ff',

    'fullscreen-background': '#ffffff',
    'fullscreen-accent': '#e8edf1',

    'page-background': '#ffffff',
    'page-foreground': '#000000',

    'project-title-inactive': 'var(--ui-white-transparent)',
    'project-title-hover': '#ffffff7f',

    'link-color': '#2255dd',

    'filter-icon-black': 'none',
    'filter-icon-gray': 'grayscale(100%)',
    'filter-icon-white': 'none',

    'paint-ui-pane-border': 'var(--ui-black-transparent)',
    'paint-text-primary': 'var(--text-primary)',
    'paint-form-border': 'var(--ui-black-transparent)',
    'paint-looks-secondary': 'var(--looks-secondary)',
    'paint-looks-transparent': 'var(--looks-transparent)',
    'paint-input-background': 'var(--input-background)',
    'paint-popover-background': 'var(--popover-background)',
    'paint-filter-icon-gray': 'none'
};

const blockColors = {};

export {
    guiColors,
    blockColors
};
