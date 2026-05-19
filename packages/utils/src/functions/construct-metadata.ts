import { Metadata } from "next";

export function constructMetadata({
  title,
  fullTitle,
  description = "Convrs — Build conversations, forms, and user interactions with a fast and modern developer experience.",
  image = "https://convrs.dev/og-image.png",
  video,
  icons = {
    icon: [
      { url: "/favicons/favicon.ico" },
      {
        url: "/favicons/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/favicons/apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
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
        ? `${title} | Convrs`
        : "Convrs — Modern conversation infrastructure"),

    description,

    openGraph: {
      title:
        fullTitle ||
        (title
          ? `${title} | Convrs`
          : "Convrs — Modern conversation infrastructure"),
      description,
      ...(image && {
        images: image,
      }),
      url,
      ...(video && {
        videos: video,
      }),
      siteName: "Convrs",
      type: "website",
    },

    twitter: {
      title:
        fullTitle ||
        (title
          ? `${title} | Convrs`
          : "Convrs — Modern conversation infrastructure"),
      description,
      ...(image && {
        card: "summary_large_image",
        images: [image],
      }),
    },

    icons,

    metadataBase: new URL("https://convrs.dev"),

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