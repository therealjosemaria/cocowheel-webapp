"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cocowheelsApi } from "@/lib/api-client";
import type { PersonalDetails } from "@/lib/personal-details";

/** Decorative overlay: the existing profile icon remains underneath as fallback. */
export default function ProfileMenuPhoto({ username }: { username: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  useEffect(() => {
    let generation = 0;
    let active = true;
    const refresh = async () => {
      const request = ++generation;
      try {
        const profile = await cocowheelsApi<PersonalDetails>("/api/profile");
        if (active && request === generation)
          setSrc(profile.username === username ? profile.photoUrl : null);
      } catch {
        if (active && request === generation) setSrc(null);
      }
    };
    void refresh();
    window.addEventListener("cocowheels:profile-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("cocowheels:profile-changed", refresh);
    };
  }, [username]);

  return src ? (
    <Image
      key={src}
      className={`profile-menu-photo${loadedSrc === src ? " loaded" : ""}`}
      src={src}
      alt=""
      width={40}
      height={40}
      unoptimized
      onLoad={() => setLoadedSrc(src)}
      onError={() => setLoadedSrc(null)}
    />
  ) : null;
}
