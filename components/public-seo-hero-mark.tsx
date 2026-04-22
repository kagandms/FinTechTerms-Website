const SEO_HERO_MARK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="32" fill="#020617"/>
  <text x="128" y="112" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#ffffff">FinTech</text>
  <text x="128" y="172" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#ffffff">Terms</text>
</svg>
`;

const SEO_HERO_MARK_SRC = `data:image/svg+xml,${encodeURIComponent(SEO_HERO_MARK_SVG)}`;

export default function PublicSeoHeroMark() {
    return (
        <img
            src={SEO_HERO_MARK_SRC}
            alt="FinTechTerms"
            width={256}
            height={256}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            className="mx-auto mb-5 h-64 w-64 rounded-[2rem] object-contain shadow-sm sm:hidden"
        />
    );
}
