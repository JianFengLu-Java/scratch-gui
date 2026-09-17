import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {IntlProvider} from 'react-intl';

import SpriteSelector from '../../../src/components/sprite-selector/sprite-selector';
import StageSelector from '../../../src/components/stage-selector/stage-selector';
import {
    dispatchEditorResourceCommand,
    PLANET_EDITOR_RESOURCE_COMMAND_EVENT
} from '../../../src/lib/editor-dock-events';

jest.mock('../../../src/containers/sprite-info.jsx', () => () => null);
jest.mock('../../../src/components/sprite-selector/sprite-list.jsx', () => () => null);

const commands = [
    ['sprite-library', 'onNewSpriteClick'],
    ['sprite-paint', 'onPaintSpriteClick'],
    ['sprite-surprise', 'onSurpriseSpriteClick'],
    ['sprite-upload', 'onFileUploadClick'],
    ['backdrop-library', 'onNewBackdropClick'],
    ['backdrop-paint', 'onEmptyBackdropClick'],
    ['backdrop-surprise', 'onSurpriseBackdropClick'],
    ['backdrop-upload', 'onBackdropFileUploadClick']
];

describe('dock resource commands', () => {
    let originalWindow;
    let view;
    let handlers;

    const selectors = (readOnly = false) => (
        <IntlProvider locale="en">
            <React.Fragment>
                <SpriteSelector
                    {...Object.fromEntries(commands.filter(([command]) => command.startsWith('sprite-'))
                        .map(([, prop]) => [prop, handlers[prop]]))}
                    readOnly={readOnly}
                    sprites={{}}
                    stageSize="large"
                />
                <StageSelector
                    {...Object.fromEntries(commands.filter(([command]) => command.startsWith('backdrop-'))
                        .map(([, prop]) => [prop, handlers[prop]]))}
                    backdropCount={1}
                    raised={false}
                    readOnly={readOnly}
                    receivedBlocks={false}
                    selected={false}
                />
            </React.Fragment>
        </IntlProvider>
    );

    beforeEach(() => {
        originalWindow = global.window;
        global.window = new EventTarget();
        handlers = Object.fromEntries(commands.map(([, prop]) => [prop, jest.fn()]));
        act(() => {
            view = renderer.create(selectors());
        });
    });

    afterEach(() => {
        act(() => view.unmount());
        global.window = originalWindow;
    });

    test.each(commands)('%s forwards a usable event to its existing handler exactly once', (command, prop) => {
        act(() => dispatchEditorResourceCommand(command));
        expect(handlers[prop]).toHaveBeenCalledTimes(1);
        const event = handlers[prop].mock.calls[0][0];
        expect(event).toBeInstanceOf(CustomEvent);
        expect(event.type).toBe(PLANET_EDITOR_RESOURCE_COMMAND_EVENT);
        expect(event.detail.command).toBe(command);
        // Existing backdrop handlers stop propagation; the sprite-library handler prevents default.
        expect(() => {
            event.stopPropagation();
            event.preventDefault();
        }).not.toThrow();
        Object.entries(handlers).filter(([name]) => name !== prop)
            .forEach(([, handler]) => expect(handler).not.toHaveBeenCalled());
    });

    test('does not execute resource commands in read-only mode and resumes once editable', () => {
        act(() => view.update(selectors(true)));
        commands.forEach(([command]) => dispatchEditorResourceCommand(command));
        Object.values(handlers).forEach(handler => expect(handler).not.toHaveBeenCalled());
        act(() => view.update(selectors(false)));
        commands.forEach(([command]) => dispatchEditorResourceCommand(command));
        Object.values(handlers).forEach(handler => expect(handler).toHaveBeenCalledTimes(1));
    });

    test('uses current handlers after a rerender without leaving duplicate listeners', () => {
        const previous = handlers.onEmptyBackdropClick;
        handlers.onEmptyBackdropClick = jest.fn();
        act(() => view.update(selectors()));
        dispatchEditorResourceCommand('backdrop-paint');
        expect(previous).not.toHaveBeenCalled();
        expect(handlers.onEmptyBackdropClick).toHaveBeenCalledTimes(1);
    });

    test('ignores unrelated commands and removes listeners on unmount', () => {
        dispatchEditorResourceCommand('unrelated');
        act(() => view.unmount());
        commands.forEach(([command]) => dispatchEditorResourceCommand(command));
        Object.values(handlers).forEach(handler => expect(handler).not.toHaveBeenCalled());
    });
});
