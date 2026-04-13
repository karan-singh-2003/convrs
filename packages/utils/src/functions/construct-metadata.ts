import { Metadata } from "next";

export function constructMetadata({
  title,
  fullTitle,
  description = "Visitors - Fast and reliable visitor analytics for your SaaS. Get insights on user behavior, traffic sources, and more to grow your business.",
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
        ? `${title} | Visitors`
        : "Visitors — Fast and reliable visitor analytics"),

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
      siteName: "Visitors",
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

    metadataBase: new URL("https://visitors.dev"),

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
