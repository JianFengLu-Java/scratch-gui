import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import EventEmitter from 'events';
import {PlanetAchievementManager, MANAGE_ACHIEVEMENTS} from '../../../src/components/planet-achievement-manager/planet-achievement-manager';

jest.mock('../../../src/containers/modal.jsx', () => 'Modal');
jest.mock('react-intl', () => ({FormattedMessage: 'Message'}));

let renderer;
let runtime;
let vm;
let frameWindow;
let listeners;
const originalGlobals = {};

beforeEach(() => {
    jest.useFakeTimers();
    listeners = new Set();
    for (const name of ['window', 'location', 'crypto']) originalGlobals[name] = Object.getOwnPropertyDescriptor(global, name);
    Object.defineProperty(global, 'window', {configurable: true, value: {
        addEventListener: (type, listener) => { if (type === 'message') listeners.add(listener); },
        removeEventListener: (type, listener) => listeners.delete(listener)
    }});
    Object.defineProperty(global, 'location', {configurable: true, value: {origin: 'https://planet.example'}});
    Object.defineProperty(global, 'crypto', {configurable: true, value: {randomUUID: () => 'test-channel'}});
    runtime = new EventEmitter();
    runtime.planetAchievementClient = {reload: jest.fn()};
    vm = {runtime};
    act(() => {
        renderer = TestRenderer.create(<PlanetAchievementManager vm={vm} theme="light" />, {
            createNodeMock: element => {
                if (element.type !== 'iframe') return null;
                frameWindow = {};
                return {contentWindow: frameWindow};
            }
        });
    });
    act(() => { runtime.emit(MANAGE_ACHIEVEMENTS, '10'); });
});
afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
    for (const name of ['window', 'location', 'crypto']) {
        if (originalGlobals[name]) Object.defineProperty(global, name, originalGlobals[name]);
        else delete global[name];
    }
});

const send = (extra = {}, origin = location.origin, source) => {
    act(() => listeners.forEach(listener => listener({origin, source: source || frameWindow,
        data: {type: 'PLANET_ACHIEVEMENT_READY', projectId: '10', channel: 'test-channel', theme: 'light', ...extra}})));
};
const frame = () => renderer.root.findByType('iframe');

test('never exposes the embedded default theme before a trusted ready message', () => {
    expect(frame().props['data-ready']).toBe(false);
    expect(renderer.root.findAllByProps({role: 'status'})).toHaveLength(1);
    send({}, 'https://foreign.example');
    send({}, location.origin, window);
    send({channel: 'wrong'});
    send({projectId: '11'});
    expect(frame().props['data-ready']).toBe(false);
    send();
    expect(frame().props['data-ready']).toBe(true);
    expect(renderer.root.findAllByProps({role: 'status'})).toHaveLength(0);
    act(() => jest.advanceTimersByTime(20000));
    expect(renderer.root.findAllByProps({role: 'alert'})).toHaveLength(0);
});

test('offers retry on a stalled initialization and ignores the replaced frame', () => {
    const oldWindow = frameWindow;
    act(() => jest.advanceTimersByTime(15000));
    expect(renderer.root.findAllByProps({role: 'alert'})).toHaveLength(1);
    act(() => renderer.root.findByType('button').props.onClick());
    expect(renderer.root.findAllByProps({role: 'status'})).toHaveLength(1);
    send({}, location.origin, oldWindow);
    expect(frame().props['data-ready']).toBe(false);
    send();
    expect(frame().props['data-ready']).toBe(true);
});

test('gates a new theme navigation until the embedded page is ready', () => {
    send();
    act(() => renderer.update(<PlanetAchievementManager vm={vm} theme="dark" />));
    expect(frame().props.src).toContain('theme=dark');
    expect(frame().props['data-ready']).toBe(false);
    send();
    expect(frame().props['data-ready']).toBe(false);
    send({theme: 'dark'});
    expect(frame().props['data-ready']).toBe(true);
});
