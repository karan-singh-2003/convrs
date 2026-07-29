export const validSlugRegex = new RegExp("^[a-zA-Z0-9\\-]+$");

import { ccTLDs, SECOND_LEVEL_DOMAINS, SPECIAL_APEX_DOMAINS } from "../constants";
import { isValidUrl } from "./url";


export const validDomainRegex = new RegExp(
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
);


export const getApexDomain = (url: string) => {
    let domain;
    try {
        // replace any custom scheme (e.g. notion://) with https://
        // use the URL constructor to get the hostname
        domain = new URL(url.replace(/^[a-zA-Z]+:\/\//, "https://")).hostname;
    } catch (e) {
        return "";
    }
    if (domain === "youtu.be") return "youtube.com";

    const parts = domain.split(".");
    if (parts.length > 2) {
        if (
            // if this is a second-level TLD (e.g. co.uk, .com.ua, .org.tt), we need to return the last 3 parts
            (SECOND_LEVEL_DOMAINS.has(parts[parts.length - 2]) &&
                ccTLDs.has(parts[parts.length - 1])) ||
            // if it's a special subdomain for website builders (e.g. weathergpt.vercel.app/)
            SPECIAL_APEX_DOMAINS.has(parts.slice(-2).join("."))
        ) {
            return parts.slice(-3).join(".");
        }
        // otherwise, it's a subdomain (e.g. dub.vercel.app), so we return the last 2 parts
        return parts.slice(-2).join(".");
    }
    // if it's a normal domain (e.g. dub.co), we return the domain
    return domain;
};

export const getDomainWithoutWWW = (url: string) => {
    if (isValidUrl(url)) {
        return new URL(url).hostname.replace(/^www\./, "");
    }
    try {
        if (url.includes(".") && !url.includes(" ")) {
            return new URL(`https://${url}`).hostname.replace(/^www\./, "");
        }
    } catch (e) {
        return null;
    }
};

export const getSubdomain = (name: string, apexName: string) => {
    if (name === apexName) return null;
    return name.slice(0, name.length - apexName.length - 1);
};
