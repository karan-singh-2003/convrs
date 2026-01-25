"use client";
import { Button } from "@repo/ui";
import React from "react";
import { useParams, useRouter } from "next/navigation";

const DashboardPage = () => {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="flex flex-col my-4 gap-y-3 max-w-sm w-full mx-auto">
      <h1 className="font-semibold text-lg">This is a dashboard page.</h1>
      <Button
        text="security tab"
        className="text-white"
        onClick={() => {
          router.push(`/${slug}/security`);
        }}
      />
    </div>
  );
};

export default DashboardPage;
