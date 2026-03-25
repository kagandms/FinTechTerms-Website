export const normalizeSearchText = (value: string): string => (
    value
        .normalize('NFKC')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/\u0131/g, 'i')
        .replace(/\u0307/g, '')
        .replace(/\s+/g, ' ')
);
