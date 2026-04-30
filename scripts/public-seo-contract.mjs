const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const PUBLIC_LOCALES = ['ru', 'en', 'tr'];

const routeChecks = [
    {
        path: '/ru',
        jsonLdTypes: ['WebSite', 'Organization'],
    },
    {
        path: '/ru/glossary/tokenization',
        jsonLdTypes: ['DefinedTerm', 'WebPage', 'BreadcrumbList', 'FAQPage'],
        requireLocalPrerenderHeader: true,
    },
    {
        path: '/en/topics/cards-payments',
        jsonLdTypes: ['CollectionPage', 'ItemList'],
        requireLocalPrerenderHeader: true,
    },
    {
        path: '/tr/about',
        jsonLdTypes: [],
    },
];

const failures = [];

const isLocalBaseUrl = () => {
    const hostname = new URL(BASE_URL).hostname;

    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const buildUrl = (path) => new URL(path, BASE_URL).toString();

const assertCondition = (condition, message) => {
    if (!condition) {
        failures.push(message);
    }
};

const fetchText = async (path) => {
    const response = await fetch(buildUrl(path));
    const text = await response.text();

    assertCondition(response.ok, `${path}: expected 2xx response, got ${response.status}`);

    return { response, text };
};

const extractCanonicalOrigin = (html, path) => {
    const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);

    assertCondition(Boolean(canonicalMatch), `${path}: missing canonical link`);

    return canonicalMatch ? new URL(canonicalMatch[1]).origin : BASE_URL;
};

const getRouteSuffix = (path) => {
    const [, maybeLocale, ...segments] = path.split('/');

    if (!PUBLIC_LOCALES.includes(maybeLocale)) {
        return path;
    }

    return segments.length > 0 ? `/${segments.join('/')}` : '';
};

const assertCanonical = (html, path) => {
    const canonicalOrigin = extractCanonicalOrigin(html, path);
    const expectedCanonical = `${canonicalOrigin}${path}`;

    assertCondition(
        html.includes(`rel="canonical" href="${expectedCanonical}"`),
        `${path}: canonical is not ${expectedCanonical}`
    );
};

const assertHeadAlternates = (html, path) => {
    const canonicalOrigin = extractCanonicalOrigin(html, path);
    const suffix = getRouteSuffix(path);

    for (const locale of PUBLIC_LOCALES) {
        const expectedHref = `${canonicalOrigin}/${locale}${suffix}`;
        assertCondition(
            html.includes(`href="${expectedHref}"`),
            `${path}: missing head alternate for ${locale}`
        );
    }

    assertCondition(
        html.includes('hrefLang="x-default"') || html.includes('hreflang="x-default"'),
        `${path}: missing x-default alternate`
    );
};

const assertSiblingLocaleLinks = (html, path) => {
    const suffix = getRouteSuffix(path);

    for (const locale of PUBLIC_LOCALES) {
        assertCondition(
            html.includes('data-public-sibling-locale-link') && html.includes(`href="/${locale}${suffix}"`),
            `${path}: missing server-rendered sibling locale link for ${locale}`
        );
    }
};

const assertJsonLd = (html, path, jsonLdTypes) => {
    for (const type of jsonLdTypes) {
        assertCondition(
            html.includes(`"@type":"${type}"`),
            `${path}: missing JSON-LD type ${type}`
        );
    }
};

const assertPrerenderHeader = (response, path, required) => {
    if (!required || !isLocalBaseUrl()) {
        return;
    }

    const prerenderHeader = response.headers.get('x-nextjs-prerender') ?? '';
    const prerenderValues = prerenderHeader.split(',').map((value) => value.trim());

    assertCondition(
        prerenderValues.includes('1'),
        `${path}: missing x-nextjs-prerender=1 header`
    );
};

const checkHtmlRoute = async (check) => {
    const { response, text } = await fetchText(check.path);

    assertCanonical(text, check.path);
    assertHeadAlternates(text, check.path);
    assertSiblingLocaleLinks(text, check.path);
    assertJsonLd(text, check.path, check.jsonLdTypes);
    assertCondition(!text.toLowerCase().includes('noindex'), `${check.path}: unexpected noindex`);
    assertPrerenderHeader(response, check.path, check.requireLocalPrerenderHeader);
};

const checkRobots = async () => {
    const { text } = await fetchText('/robots.txt');

    assertCondition(text.includes('Allow: /'), '/robots.txt: missing allow rule');
    assertCondition(text.includes('/sitemap.xml'), '/robots.txt: missing sitemap location');
};

const checkSitemap = async () => {
    const { text } = await fetchText('/sitemap.xml');

    assertCondition(text.includes('hreflang="x-default"'), '/sitemap.xml: missing x-default hreflang');
    assertCondition(text.includes('/en/glossary/tokenization'), '/sitemap.xml: missing EN tokenization URL');
    assertCondition(text.includes('/tr/topics/cards-payments'), '/sitemap.xml: missing TR topic URL');
};

try {
    await checkRobots();
    await checkSitemap();

    for (const check of routeChecks) {
        await checkHtmlRoute(check);
    }

    if (failures.length > 0) {
        console.error('\nPublic SEO contract failures:\n');
        for (const failure of failures) {
            console.error(`- ${failure}`);
        }
        process.exit(1);
    }

    console.log('Public SEO contract passed.');
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Unknown public SEO contract failure.');
    process.exit(1);
}
