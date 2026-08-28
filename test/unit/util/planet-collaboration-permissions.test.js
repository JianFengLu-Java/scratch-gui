import {normalizePlanetCollaborationPermissions} from
    '../../../src/lib/planet-collaboration-permissions';

describe('planet collaboration permissions', () => {
    test('routes member avatars through the same-origin backend proxy', () => {
        const permissions = normalizePlanetCollaborationPermissions({
            assignments: [],
            members: [
                {id: '1', nickname: '站长', avatarUrl: '/api/v1/files/88'},
                {id: '2', nickname: '访客', avatarUrl: 'https://cdn.example/avatar.webp'},
                {id: '3', nickname: '无头像', avatarUrl: ''}
            ],
            mode: 'ASSIGNED'
        });

        expect(permissions.members.map(member => member.avatarUrl)).toEqual([
            '/backend-api/files/88',
            'https://cdn.example/avatar.webp',
            ''
        ]);
        expect(permissions.mode).toBe('ASSIGNED');
        expect(permissions.assignments).toEqual([]);
    });

    test('normalizes a missing member collection to an empty list', () => {
        expect(normalizePlanetCollaborationPermissions({mode: 'FREE'}).members).toEqual([]);
    });
});
