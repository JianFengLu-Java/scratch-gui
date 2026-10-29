import fitMobileStage, {getMobileSceneDefaultHeight} from '../../../src/lib/mobile-stage-layout';

describe('mobile stage fitting', () => {
    test('starts the scene at its content height across phone widths without enlarging small projects', () => {
        const stage = {width: 480, height: 360};
        expect(getMobileSceneDefaultHeight(stage, 320)).toBe(233);
        expect(getMobileSceneDefaultHeight(stage, 390)).toBe(275);
        expect(getMobileSceneDefaultHeight({width: 240, height: 180}, 1000)).toBe(272);
    });

    test('uses the entire canvas cell when controls are in a separate grid row', () => {
        const preview = fitMobileStage({width: 480, height: 360}, {
            width: 222, height: 167, controlsHeight: 0
        });
        expect(preview.width).toBe(220);
        expect(preview.height).toBe(165);
    });

    test.each([
        [480, 360, 374, 400],
        [480, 854, 374, 300],
        [960, 360, 304, 220],
        [480, 360, 460, 190]
    ])('fits a %s × %s project in a %s × %s preview without stretching', (width, height, cellWidth, cellHeight) => {
        const stage = {width, height};
        const preview = fitMobileStage(stage, {width: cellWidth, height: cellHeight});
        expect(preview.width / preview.height).toBeCloseTo(width / height, 8);
        expect(preview.width).toBeLessThanOrEqual(cellWidth - 2);
        expect(preview.height).toBeLessThanOrEqual(cellHeight - 46);
        expect(preview.scale).toBeLessThanOrEqual(1);
        expect(stage).toEqual({width, height});
    });

    test('reserves the compact toolbar in a narrow scene column', () => {
        const preview = fitMobileStage({width: 480, height: 360}, {
            width: 164, height: 146, controlsHeight: 36
        });
        expect(preview.height).toBeCloseTo(108);
        expect(preview.width).toBeCloseTo(144);
        expect(preview.width / preview.height).toBeCloseTo(4 / 3);
    });

    test('keeps native size when the project already fits', () => {
        expect(fitMobileStage({width: 240, height: 180}, {width: 600, height: 600}))
            .toEqual({width: 240, height: 180, scale: 1});
    });
});
