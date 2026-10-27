import fitMobileStage from '../../../src/lib/mobile-stage-layout';

describe('mobile stage fitting', () => {
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

    test('keeps native size when the project already fits', () => {
        expect(fitMobileStage({width: 240, height: 180}, {width: 600, height: 600}))
            .toEqual({width: 240, height: 180, scale: 1});
    });
});
