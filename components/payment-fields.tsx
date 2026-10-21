"use client";
import type { Ref } from "react";
import { PAYID_MAX_LENGTH } from "@/lib/input-validation";
import { validFareDraft } from "@/lib/fare";
import type { UsualRoute } from "@/lib/usual-route";

export default function PaymentFields({
  fare,
  setFare,
  payId,
  setPayId,
  type,
  setType,
  priceRef,
  payIdRef,
}: {
  fare: string;
  setFare: (value: string) => void;
  payId: string;
  setPayId: (value: string) => void;
  type: UsualRoute["payIdType"];
  setType: (value: UsualRoute["payIdType"]) => void;
  priceRef?: Ref<HTMLInputElement>;
  payIdRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="usual-payment">
      <label className="field">
        You receive
        <input
          ref={priceRef}
          required
          type="text"
          inputMode="decimal"
          maxLength={8}
          value={fare}
          onChange={(event) => {
            if (validFareDraft(event.target.value)) {
              event.target.setCustomValidity("");
              setFare(event.target.value);
            }
          }}
        />
      </label>
      <fieldset className="payid-field">
        <legend>Your PayID</legend>
        <div
          className="payid-type-options"
          role="radiogroup"
          aria-label="PayID type"
        >
          {(["MOBILE", "EMAIL", "OTHER"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              className={type === value ? "active" : undefined}
              onClick={() => setType(value)}
            >
              {value === "MOBILE"
                ? "Mobile"
                : value === "EMAIL"
                  ? "Email"
                  : "Other"}
            </button>
          ))}
        </div>
        <input
          ref={payIdRef}
          required
          aria-label={`Your PayID ${type.toLowerCase()}`}
          type={type === "EMAIL" ? "email" : type === "MOBILE" ? "tel" : "text"}
          inputMode={
            type === "EMAIL" ? "email" : type === "MOBILE" ? "tel" : "text"
          }
          placeholder={
            type === "MOBILE"
              ? "04xx xxx xxx"
              : type === "EMAIL"
                ? "name@example.com"
                : "ABN or organisation identifier"
          }
          maxLength={PAYID_MAX_LENGTH[type]}
          value={payId}
          onChange={(event) => {
            event.target.setCustomValidity("");
            setPayId(event.target.value);
          }}
        />
      </fieldset>
    </div>
  );
}
