export const getSearchParams = (url: string) => {
  // Create a params object
  let params = {} as Record<string, string>;

  new URL(url).searchParams.forEach(function (val, key) {
    params[key] = val;
  });

  return params;
};

export const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};



export const getPrettyUrl = (url?: string | null) => {
  if (!url) return "";
  // remove protocol (http/https) and www.
  // also remove trailing slash
  return url
    .replace(/(^\w+:|^)\/\//, "")
    .replace("www.", "")
    .replace(/\/$/, "");
};
