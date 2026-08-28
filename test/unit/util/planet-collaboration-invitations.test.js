import {normalizePlanetCollaborationInviteData} from
    '../../../src/lib/planet-collaboration-invitations';

describe('planet collaboration invitation avatars', () => {
    test('normalizes friend and member avatar URLs', () => {
        const data = normalizePlanetCollaborationInviteData({
            friends: [{avatarUrl: '/api/v1/files/12', id: '1'}],
            members: [{avatarUrl: '/api/v1/files/13', id: '2'}]
        });

        expect(data.friends[0].avatarUrl).toBe('/backend-api/files/12');
        expect(data.members[0].avatarUrl).toBe('/backend-api/files/13');
    });

    test('uses empty lists for incomplete responses', () => {
        expect(normalizePlanetCollaborationInviteData(null)).toEqual({
            friends: [],
            members: []
        });
    });
});
