"use client";
import { Button } from "@repo/ui";
import React from "react";
import { useSAMLModal } from "@/ui/modals/saml-modal";

const SAML = () => {
  const { setShowSAMLModal, SAMLModal } = useSAMLModal();
  return (
    <>
      <SAMLModal />
      <div className="w-full max-w-sm mx-auto my-4">
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-medium text-neutral-900">
            SAML Single Sign-On
          </h2>
          <p className="text-sm text-neutral-500 font-medium">
            Set up SAML Single Sign-On (SSO) to allow your team to sign in to{" "}
            {process.env.NEXT_PUBLIC_APP_NAME} with your identity provider.
          </p>
          <Button
            className="text-white"
            text="configure"
            onClick={() => setShowSAMLModal(true)}
          ></Button>
        </div>
      </div>
    </>
  );
};

export default SAML;
