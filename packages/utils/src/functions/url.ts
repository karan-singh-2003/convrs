export const getSearchParams = (url: string) => {
    let params = {} as Record<string, string>;
    new URL(url).searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}