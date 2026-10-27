import {getMobilePanelBounds} from '../../../src/lib/dock-panel-viewport';

describe('mobile dock panel viewport', () => {
    test('keeps the sheet above the two-row editor dock', () => {
        expect(getMobilePanelBounds({height: 844, dockTop: 724})).toEqual({
            bottom: 128, availableHeight: 704
        });
    });

    test('keeps the composer above the keyboard without reserving the hidden dock', () => {
        expect(getMobilePanelBounds({height: 844, viewportHeight: 450, dockTop: 724})).toEqual({
            bottom: 402, availableHeight: 430
        });
    });

    test('accounts for the visual viewport shifting after focusing an input', () => {
        expect(getMobilePanelBounds({
            height: 844, viewportHeight: 400, viewportTop: 90, dockTop: 724
        })).toEqual({bottom: 362, availableHeight: 380});
    });

    test('recalculates for landscape and works without an editor dock', () => {
        expect(getMobilePanelBounds({height: 390})).toEqual({bottom: 8, availableHeight: 370});
        expect(getMobilePanelBounds({height: 390, dockTop: 294})).toEqual({
            bottom: 104, availableHeight: 274
        });
    });
});
