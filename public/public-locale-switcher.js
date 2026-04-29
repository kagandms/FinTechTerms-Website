(function () {
    var locales = new Set(['ru', 'en', 'tr']);

    function getLinks() {
        return Array.prototype.slice.call(document.querySelectorAll('[data-public-locale-link]'));
    }

    function buildPath(locale) {
        var segments = window.location.pathname.split('/');

        if (!locales.has(segments[1])) {
            return '/' + locale;
        }

        segments[1] = locale;

        return (segments.join('/') || '/' + locale) + window.location.search + window.location.hash;
    }

    function syncLinks() {
        getLinks().forEach(function (link) {
            var locale = link.getAttribute('data-locale');

            if (locale && locales.has(locale)) {
                link.setAttribute('href', buildPath(locale));
            }
        });
    }

    function bindLinks() {
        getLinks().forEach(function (link) {
            if (link.getAttribute('data-locale-bound') === 'true') {
                return;
            }

            link.setAttribute('data-locale-bound', 'true');
            link.addEventListener('click', function () {
                var locale = link.getAttribute('data-locale');

                if (!locale || !locales.has(locale)) {
                    return;
                }

                document.cookie = 'ftt-language=' + locale + '; Path=/; Max-Age=31536000; SameSite=Lax';
            });
        });
    }

    syncLinks();
    bindLinks();
    window.addEventListener('hashchange', syncLinks);
}());
