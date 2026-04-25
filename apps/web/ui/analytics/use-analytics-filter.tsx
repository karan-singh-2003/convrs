"use client";

import { VALID_ANALYTICS_FILTERS } from "@/lib/analytics/constants";
import {
  BlurImage,
  Filter,
  Slider,
  useRouterStuff,
  UTM_PARAMETERS,
  Users6,
  Window,
} from "@repo/ui";
import {
  capitalize,
  CONTINENTS,
  COUNTRIES,
  currencyFormatter,
  nFormatter,
  parseFilterValue,
  REGIONS,
  type FilterOperator,
  type ParsedFilter,
} from "@repo/utils";
import { useParams } from "next/navigation";
import {
  ComponentProps,
  ContextType,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  AnalyticsContext,
  AnalyticsDashboardProps,
} from "./analytics-providers";

import { DeviceIcon } from "./device-icon";

import { TRIGGER_DISPLAY } from "./trigger-display";
import { useAnalyticsFilterOption } from "./use-analytics-filter-option";

export function useAnalyticsFilters({
  partnerPage,
  dashboardProps,
  context,
  programPage = false,
}: {
  partnerPage?: boolean;
  dashboardProps?: AnalyticsDashboardProps;
  context?: Pick<
    ContextType<typeof AnalyticsContext>,
    | "baseApiPath"
    | "queryString"
    | "selectedTab"
    | "saleUnit"
    | "requiresUpgrade"
  >;
  programPage?: boolean;
} = {}) {
  const { selectedTab, saleUnit } = context ?? useContext(AnalyticsContext);

  const { slug } = useParams();

  const { queryParams, searchParamsObj } = useRouterStuff();

  const [requestedFilters, setRequestedFilters] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<boolean>(false);

  const parseFilterParam = useCallback(
    (value: string): ParsedFilter | undefined => {
      return parseFilterValue(value);
    },
    []
  );

  const activeFilters = useMemo(() => {
    const { domain, key, root, ...params } = searchParamsObj;

    // Handle special cases first
    const filters: Array<{
      key: string;
      operator: FilterOperator;
      values: any[];
    }> = [
      // Legacy: show one link chip when domain+key are present (no linkId)
      ...(domain && key && !params.linkId
        ? [
            {
              key: "linkId",
              operator: "IS" as FilterOperator,
              values: [`${domain}/${key}`],
            },
          ]
        : []),
    ];

    // Handle all filters dynamically (including domain, tagId, folderId, root)
    VALID_ANALYTICS_FILTERS.forEach((filter) => {
      // Skip special cases we handled above
      if (["key"].includes(filter)) return;
      // Also skip date range filters and qr
      if (["interval", "start", "end", "qr"].includes(filter)) return;
      // Skip domain if we're showing a specific link (domain + key) without linkId
      if (filter === "domain" && domain && key && !params.linkId) return;

      const value =
        params[filter] ||
        (filter === "domain" ? domain : filter === "root" ? root : undefined);

      if (value) {
        const parsed = parseFilterParam(value);
        if (parsed) {
          filters.push({
            key: filter,
            operator: parsed.operator,
            values: parsed.values,
          });
        }
      }
    });

    return filters;
  }, [searchParamsObj, partnerPage, parseFilterParam]);

  const isRequested = useCallback(
    (key: string) =>
      requestedFilters.includes(key) ||
      activeFilters.some((af) => af.key === key),
    [requestedFilters, activeFilters]
  );

  const { data: countries } = useAnalyticsFilterOption("countries", {
    disabled: !isRequested("country"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: regions } = useAnalyticsFilterOption("regions", {
    disabled: !isRequested("region"),
    omitGroupByFilterKey: true,
    context,
  });

  const { data: cities } = useAnalyticsFilterOption("cities", {
    disabled: !isRequested("city"),
    omitGroupByFilterKey: true,
    context,
  });

  const { data: continents } = useAnalyticsFilterOption("continents", {
    disabled: !isRequested("continent"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: devices } = useAnalyticsFilterOption("devices", {
    disabled: !isRequested("device"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: browsers } = useAnalyticsFilterOption("browsers", {
    disabled: !isRequested("browser"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: os } = useAnalyticsFilterOption("os", {
    disabled: !isRequested("os"),
    omitGroupByFilterKey: true,
    context,
  });

  const { data: referers } = useAnalyticsFilterOption("referers", {
    disabled: !isRequested("referer"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: refererUrls } = useAnalyticsFilterOption("referer_urls", {
    disabled: !isRequested("refererUrl"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: baseUrls } = useAnalyticsFilterOption("top_base_urls", {
    disabled: !isRequested("url"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: utmSources } = useAnalyticsFilterOption("utm_sources", {
    disabled: !isRequested("utm_source"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: utmMediums } = useAnalyticsFilterOption("utm_mediums", {
    disabled: !isRequested("utm_medium"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: utmCampaigns } = useAnalyticsFilterOption("utm_campaigns", {
    disabled: !isRequested("utm_campaign"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: utmTerms } = useAnalyticsFilterOption("utm_terms", {
    disabled: !isRequested("utm_term"),
    omitGroupByFilterKey: true,
    context,
  });
  const { data: utmContents } = useAnalyticsFilterOption("utm_contents", {
    disabled: !isRequested("utm_content"),
    omitGroupByFilterKey: true,
    context,
  });

  const utmData = {
    utm_source: utmSources,
    utm_medium: utmMediums,
    utm_campaign: utmCampaigns,
    utm_term: utmTerms,
    utm_content: utmContents,
  };

  const getFilterOptionTotal = useCallback(
    ({ count }: { count?: number; saleAmount?: number }) => {
      return nFormatter(count, { full: true });
    },
    [selectedTab, saleUnit]
  );

  const filters: ComponentProps<typeof Filter.Select>["filters"] = useMemo(
    () => [
      {
        key: "country",

        label: "Country",
        labelPlural: "countries",
        getOptionIcon: (value) => {
          if (typeof value !== "string") return null;

          return (
            <img
              alt={value}
              src={`https://hatscripts.github.io/circle-flags/flags/${value.toLowerCase()}.svg`}
              className="size-4 shrink-0"
            />
          );
        },
        options:
          countries?.map(({ country, ...rest }) => ({
            value: country,
            label: COUNTRIES[country],
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      {
        key: "city",

        label: "City",
        labelPlural: "cities",
        options:
          cities?.map(({ city, country, ...rest }) => ({
            value: city,
            label: city,
            icon: (
              <img
                alt={country}
                src={`https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg`}
                className="size-4 shrink-0"
              />
            ),
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      {
        key: "region",

        label: "Region",
        options:
          regions?.map(({ region, country, ...rest }) => ({
            value: region,
            label: REGIONS[region] || region.split("-")[1],
            icon: (
              <img
                alt={country}
                src={`https://hatscripts.github.io/circle-flags/flags/${country.toLowerCase()}.svg`}
                className="size-4 shrink-0"
              />
            ),
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      {
        key: "continent",

        label: "Continent",

        getOptionLabel: (value) => {
          if (typeof value !== "string") return String(value);
          return CONTINENTS[value] || value;
        },
        options:
          continents?.map(({ continent, ...rest }) => ({
            value: continent,
            label: CONTINENTS[continent],
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      {
        key: "device",

        label: "Device",
        hideMultipleIcons: true,
        getOptionIcon: (value) => {
          if (typeof value !== "string") return null;
          return (
            <DeviceIcon
              display={capitalize(value) ?? value}
              tab="devices"
              className="h-4 w-4"
            />
          );
        },
        options:
          devices?.map(({ device, ...rest }) => ({
            value: device,
            label: device,
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      {
        key: "browser",

        label: "Browser",
        getOptionIcon: (value) => {
          if (typeof value !== "string") return null;
          return (
            <DeviceIcon display={value} tab="browsers" className="h-4 w-4" />
          );
        },
        options:
          browsers?.map(({ browser, ...rest }) => ({
            value: browser,
            label: browser,
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      {
        key: "os",

        label: "OS",
        labelPlural: "OS",
        hideMultipleIcons: true,
        getOptionIcon: (value) => {
          if (typeof value !== "string") return null;
          return <DeviceIcon display={value} tab="os" className="h-4 w-4" />;
        },
        options:
          os?.map(({ os, ...rest }) => ({
            value: os,
            label: os,
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      ...(programPage ? [] : []),
      {
        key: "referer",

        label: "Referrer",

        options:
          referers?.map(({ referer, ...rest }) => ({
            value: referer,
            label: referer,
            right: getFilterOptionTotal(rest),
          })) ?? null,
      },
      ...(programPage
        ? []
        : [
            {
              key: "refererUrl",

              label: "Referrer URL",

              options:
                refererUrls?.map(({ refererUrl, ...rest }) => ({
                  value: refererUrl,
                  label: refererUrl,
                  right: getFilterOptionTotal(rest),
                })) ?? null,
            },

            ...UTM_PARAMETERS.filter(({ key }) => key !== "ref").map(
              ({ key, label }) => ({
                key,

                label: `UTM ${label}`,

                options:
                  utmData[key]?.map((dt) => ({
                    value: dt[key],
                    label: dt[key],
                    right: nFormatter(dt.count, { full: true }),
                  })) ?? null,
              })
            ),
          ]),
      // additional fields that are hidden in filter dropdown
    ],
    [
      dashboardProps,
      partnerPage,

      countries,
      cities,
      devices,
      browsers,
      os,
      referers,
      refererUrls,
      baseUrls,
      utmData,
      searchParamsObj.tagId,
      searchParamsObj.domain,
    ]
  );

  const onSelect = useCallback(
    async (key, value) => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          queryParams({
            del: key,
            scroll: false,
          });
        } else {
          const currentParam = searchParamsObj[key];
          const isNegated = currentParam?.startsWith("-") ?? false;

          const newParam = isNegated ? `-${value.join(",")}` : value.join(",");

          queryParams({
            set: { [key]: newParam },
            del: "page",
            scroll: false,
          });
        }

        return;
      }

      const currentParam = searchParamsObj[key];
      const filterDef = filters.find((f) => f.key === key);
      const isSingleSelect = filterDef?.singleSelect;

      if (!currentParam || isSingleSelect) {
        queryParams({
          set: { [key]: value },
          del: "page",
          scroll: false,
        });
      } else {
        const parsed = parseFilterParam(currentParam);

        if (parsed && !parsed.values.includes(value)) {
          const newValues = [...parsed.values, value];
          const newParam = parsed.operator.includes("NOT")
            ? `-${newValues.join(",")}`
            : newValues.join(",");

          queryParams({
            set: { [key]: newParam },
            del: "page",
            scroll: false,
          });
        }
      }
    },
    [queryParams, activeFilters, searchParamsObj, parseFilterParam, filters]
  );

  const onRemove = useCallback(
    (key, value) => {
      const currentParam = searchParamsObj[key];

      if (!currentParam) return;

      const parsed = parseFilterParam(currentParam);
      if (!parsed) {
        queryParams({ del: key, scroll: false });
        return;
      }

      const newValues = parsed.values.filter((v) => v !== value);

      if (newValues.length === 0) {
        queryParams({ del: key, scroll: false });
      } else {
        const newParam = parsed.operator.includes("NOT")
          ? `-${newValues.join(",")}`
          : newValues.join(",");

        queryParams({
          set: { [key]: newParam },
          scroll: false,
        });
      }
    },
    [queryParams, searchParamsObj, parseFilterParam]
  );

  const onRemoveAll = useCallback(
    () =>
      queryParams({
        // Reset all filters except for date range
        del: VALID_ANALYTICS_FILTERS.concat(["page"]).filter(
          (f) => !["interval", "start", "end"].includes(f)
        ),
        scroll: false,
      }),
    [queryParams]
  );

  const onOpenFilter = useCallback((key) => {
    console.log("open filter", key);
    console.log("isRequested(city):", isRequested("city"));
    setRequestedFilters((rf) => (rf.includes(key) ? rf : [...rf, key]));
  }, []);

  const onToggleOperator = useCallback(
    (key) => {
      const currentParam = searchParamsObj[key];
      if (!currentParam) return;

      const isNegated = currentParam.startsWith("-");
      const cleanValue = isNegated ? currentParam.slice(1) : currentParam;

      const newParam = isNegated ? cleanValue : `-${cleanValue}`;

      queryParams({
        set: { [key]: newParam },
        del: "page",
        scroll: false,
      });
    },
    [searchParamsObj, queryParams]
  );

  const onRemoveFilter = useCallback(
    (key) => queryParams({ del: key, scroll: false }),
    [queryParams]
  );

  const activeFiltersWithStreaming = useMemo(() => {
    return [
      ...activeFilters,
      ...(streaming && !activeFilters.length
        ? Array.from({ length: 2 }, (_, i) => i).map((i) => ({
            key: "loader",
            values: [String(i)],
            operator: "IS" as const,
          }))
        : []),
    ];
  }, [activeFilters, streaming]);

  return {
    filters,
    activeFilters,
    onSelect,
    onRemove,
    onRemoveFilter,
    onRemoveAll,
    onOpenFilter,
    onToggleOperator,
    streaming,
    activeFiltersWithStreaming,
  };
}
