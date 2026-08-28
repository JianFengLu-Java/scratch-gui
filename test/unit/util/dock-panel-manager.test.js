import {registerDockPanel} from '../../../src/lib/dock-panel-manager';

describe('dock panel manager', () => {
    const registrations = [];
    const listeners = new Map();

    beforeEach(() => {
        global.document = {
            addEventListener: (type, listener) => listeners.set(type, listener),
            removeEventListener: (type, listener) => {
                if (listeners.get(type) === listener) listeners.delete(type);
            }
        };
    });

    const register = (panelId, onClose = jest.fn()) => {
        const styles = new Map();
        const attributes = new Map();
        const element = {
            style: {
                getPropertyValue: name => styles.get(name) || '',
                setProperty: (name, value) => styles.set(name, value)
            },
            getAttribute: name => attributes.get(name) || null,
            setAttribute: (name, value) => attributes.set(name, value)
        };
        const registration = registerDockPanel(panelId, element, onClose);
        registrations.push({element, registration});
        return {element, onClose, registration};
    };

    afterEach(() => {
        while (registrations.length) {
            const current = registrations.pop();
            current.registration.unregister();
        }
        listeners.clear();
        delete global.document;
    });

    test('keeps panels mounted and cascades each new window', () => {
        const first = register('chat');
        const second = register('ai');

        expect(first.element.getAttribute('data-dock-panel-active')).toBe('false');
        expect(second.element.getAttribute('data-dock-panel-active')).toBe('true');
        expect(first.element.style.getPropertyValue('--dock-panel-cascade-x')).toBe('0px');
        expect(second.element.style.getPropertyValue('--dock-panel-cascade-x')).toBe('24px');
        expect(first.onClose).not.toHaveBeenCalled();
    });

    test('activates a background panel without closing the others', () => {
        const first = register('chat');
        const second = register('ai');

        first.registration.activate();

        expect(first.element.getAttribute('data-dock-panel-active')).toBe('true');
        expect(second.element.getAttribute('data-dock-panel-active')).toBe('false');
        expect(first.onClose).not.toHaveBeenCalled();
        expect(second.onClose).not.toHaveBeenCalled();
    });

    test('escape closes only the topmost panel', () => {
        const first = register('chat');
        const second = register('ai');

        listeners.get('keydown')({
            defaultPrevented: false,
            key: 'Escape',
            preventDefault: jest.fn(),
            repeat: false,
            target: null
        });

        expect(second.onClose).toHaveBeenCalledTimes(1);
        expect(first.onClose).not.toHaveBeenCalled();
    });
});
