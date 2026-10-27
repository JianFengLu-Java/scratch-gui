import {PlanetAchievementClient} from '../../../src/lib/planet-achievement-extension';

const definition = () => ({id: '42', name: '首次通关', enabled: true, earned: false});
const client = options => new PlanetAchievementClient({emit: jest.fn()}, {
    list: jest.fn(async () => [definition()]), claim: jest.fn(async () => ({firstAward: true})), ...options
});

test('preview never calls the award service and ignores foreign badge identifiers', async () => {
    const value = client({preview: true});
    await value.reload();
    await value.unlock('42');
    await value.unlock('other-project');
    expect(await value.has('42')).toBe(true);
    expect(await value.has('other-project')).toBe(false);
    expect(value.options.claim).not.toHaveBeenCalled();
    expect(value.runtime.emit).toHaveBeenCalledTimes(1);
    expect(value.runtime.emit.mock.calls[0][1]).toContain('预览');
});

test('concurrent clone events coalesce and only confirmed awards become earned', async () => {
    let resolve;
    const claim = jest.fn(() => new Promise(done => { resolve = done; }));
    const value = client({claim});
    await value.reload();
    const first = value.unlock('42');
    const second = value.unlock('42');
    await Promise.resolve();
    expect(claim).toHaveBeenCalledTimes(1);
    expect(await value.has('42')).toBe(false);
    resolve({firstAward: true});
    await Promise.all([first, second]);
    expect(await value.has('42')).toBe(true);
    await value.unlock('42');
    expect(claim).toHaveBeenCalledTimes(1);
});

test('failed claims remain unearned and can retry after cooldown', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const claim = jest.fn().mockRejectedValueOnce(new Error('请登录')).mockResolvedValue({firstAward: true});
    const value = client({claim});
    await value.reload(); await value.unlock('42');
    expect(await value.has('42')).toBe(false);
    await value.unlock('42'); expect(claim).toHaveBeenCalledTimes(1);
    now.mockReturnValue(5000); await value.unlock('42');
    expect(await value.has('42')).toBe(true);
    now.mockRestore();
});

test('account reset discards an earlier account response', async () => {
    let resolve;
    const value = client({claim: () => new Promise(done => { resolve = done; })});
    await value.reload(); const pending = value.unlock('42'); await Promise.resolve();
    await value.reload(); resolve({firstAward: true}); await pending;
    expect(await value.has('42')).toBe(false);
});
