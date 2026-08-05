/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Productfoto's komen uit de feed van het dashboard (Tilroy S3, via de
    // cloudimg-CDN) en van het dashboard zelf.
    remotePatterns: [
      { protocol: "https", hostname: "prosteps.cloudimg.io" },
      { protocol: "https", hostname: "tilroy.s3.eu-west-1.amazonaws.com" },
      { protocol: "https", hostname: "dashboardvdm.vercel.app" },
      // Actiebanners: Kevin zet ze in het dashboard, dat ze op Vercel Blob
      // opslaat. Zonder deze regel weigert next/image het adres en blijft de
      // slideshow leeg.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
