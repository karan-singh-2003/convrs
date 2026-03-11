import { Metadata } from "next";

export function constructMetadata({
  title,
  fullTitle,
  description = "Boilercode is a production-ready SaaS starter that helps developers launch modern web applications faster with authentication, workspaces, billing, and scalable infrastructure.",
  image = "https://boilercode.dev/og-image.png",
  video,
  icons = {
    icon: [
      { url: "/favicons/favicon.ico" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/favicons/apple-touch-icon.png", sizes: "180x180" }],
  },
  url,
  canonicalUrl,
  noIndex = false,
  manifest,
}: {
  title?: string;
  fullTitle?: string;
  description?: string;
  image?: string | null;
  video?: string | null;
  icons?: Metadata["icons"];
  url?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  manifest?: string | URL | null;
} = {}): Metadata {
  return {
    title:
      fullTitle ||
      (title
        ? `${title} | Boilercode`
        : "Boilercode — Production-Ready SaaS Starter"),

    description,

    openGraph: {
      title,
      description,
      ...(image && {
        images: image,
      }),
      url,
      ...(video && {
        videos: video,
      }),
      siteName: "BoilerCode",
      type: "website",
    },

    twitter: {
      title,
      description,
      ...(image && {
        card: "summary_large_image",
        images: [image],
      }),
    },

    icons,

    metadataBase: new URL("https://boilercode.dev"),

    ...((url || canonicalUrl) && {
      alternates: {
        canonical: url || canonicalUrl,
      },
    }),

    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),

    ...(manifest && {
      manifest,
    }),
  };
}
