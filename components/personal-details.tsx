"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import {
  type PersonalDetails as Details,
  USERNAME_ERROR,
  validUsername,
} from "@/lib/personal-details";
import { prepareBrowserPhoto } from "@/lib/profile-photo";
import RideFieldLabel from "./ride-field-label";

export default function PersonalDetails() {
  const [profile, setProfile] = useState<Details | null>(null);
  const [username, setUsername] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    let active = true;
    cocowheelsApi<Details>("/api/profile")
      .then((data) => {
        if (active) {
          setProfile(data);
          setUsername(data.username);
          setError("");
        }
      })
      .catch((reason) => {
        if (active) setError(apiErrorMessage(reason));
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [reload]);
  const src = photo ?? profile?.photoUrl;
  function cancel() {
    setEditing(false);
    setUsername(profile!.username);
    setPhoto(undefined);
    setError("");
  }
  return (
    <details className="contribution-choice profile-disclosure personal-details">
      <summary>
        <RideFieldLabel icon="rider">Personal details</RideFieldLabel>
      </summary>
      <form
        className="vehicle-fields"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !profile) return;
          if (!validUsername(username)) {
            setError(USERNAME_ERROR);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await cocowheelsApi<Details>(
              "/api/profile",
              { method: "POST", body: JSON.stringify({ username, photo }) },
              true,
            );
            if (!alive.current) return;
            setProfile(result);
            setUsername(result.username);
            setPhoto(undefined);
            setEditing(false);
            window.dispatchEvent(new Event("cocowheels:profile-changed"));
          } catch (reason) {
            if (alive.current)
              setError(
                reason instanceof ApiError &&
                  reason.code === "USERNAME_UNAVAILABLE"
                  ? "That username is unavailable. Try another."
                  : reason instanceof ApiError &&
                      reason.code === "INVALID_USERNAME"
                    ? USERNAME_ERROR
                    : reason instanceof ApiError &&
                        reason.code === "INVALID_PROFILE_PHOTO"
                      ? "Choose a valid JPG, PNG or WebP photo."
                      : reason instanceof ApiError &&
                          reason.code === "PHOTO_BUSY"
                        ? "Photo processing is busy. Please try again shortly."
                        : apiErrorMessage(reason),
              );
          } finally {
            if (alive.current) setBusy(false);
          }
        }}
      >
        {error && <p role="alert">{error}</p>}
        {!profile ? (
          error ? (
            <button
              type="button"
              className="secondary"
              onClick={() => setReload((x) => x + 1)}
            >
              Try again
            </button>
          ) : (
            <p>Loading…</p>
          )
        ) : (
          <>
            <div className="profile-photo-preview">
              {src ? (
                <Image
                  src={src}
                  alt="Your profile photo"
                  width={96}
                  height={96}
                  unoptimized
                />
              ) : (
                <svg
                  aria-label="No profile photo"
                  role="img"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
                </svg>
              )}
            </div>
            {editing && (
              <label className="secondary photo-upload-control">
                {profile.photoUrl || photo ? "Update photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  aria-label={
                    profile.photoUrl || photo ? "Update photo" : "Add photo"
                  }
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setBusy(true);
                    setError("");
                    try {
                      const result = await prepareBrowserPhoto(file);
                      if (alive.current) setPhoto(result);
                    } catch (reason) {
                      if (alive.current)
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : "Choose another photo.",
                        );
                    } finally {
                      if (alive.current) setBusy(false);
                    }
                  }}
                />
              </label>
            )}
            {editing ? (
              <label className="field">
                Username
                <input
                  value={username}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  minLength={3}
                  maxLength={8}
                  pattern="[a-z0-9]{3,8}"
                  title={USERNAME_ERROR}
                  disabled={busy}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                />
              </label>
            ) : (
              <dl className="profile-personal-summary">
                <div>
                  <dt>Username</dt>
                  <dd>{profile.username}</dd>
                </div>
              </dl>
            )}
            <dl className="profile-personal-summary">
              <div>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
            </dl>
            {editing ? (
              <div className="ride-action-buttons">
                <button className="primary" disabled={busy}>
                  {busy ? "Please wait…" : "Save"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={cancel}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
          </>
        )}
      </form>
    </details>
  );
}
