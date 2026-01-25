import { NextRequest } from "next/server";

export const parse = (req:NextRequest) => {
   const domain = req.headers.get("host")!.replace(/^www./, "").toLowerCase();
  const path = req.nextUrl.pathname;

  const searchParams = req.nextUrl.searchParams.toString();
  const searchParamsObj = Object.fromEntries(req.nextUrl.searchParams);
  const searchParamsString = searchParams ? `?${searchParams}` : "";

  const fullPath = `${path}${searchParamsString}`;

  const key = decodeURIComponent(path.split("/")[1] ?? "");
  const fullKey = decodeURIComponent(path.slice(1));

  return {
    domain,
    path,
    fullPath,
    key,
    fullKey,
    searchParamsObj,
    searchParamsString,
  };
}