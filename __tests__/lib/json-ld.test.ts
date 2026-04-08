import { serializeJsonLd } from '@/lib/json-ld';

describe('serializeJsonLd', () => {
    it('escapes HTML-significant characters in JSON-LD output', () => {
        const payload = {
            name: '</script><script>alert(1)</script>',
            note: '<b>safe</b>',
        };

        const serialized = serializeJsonLd(payload);

        expect(serialized).not.toContain('</script>');
        expect(serialized).not.toContain('<script>');
        expect(serialized).toContain('\\u003c');
        expect(JSON.parse(serialized)).toEqual(payload);
    });
});
