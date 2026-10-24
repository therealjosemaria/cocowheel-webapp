"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function ParticipantName({ name }: { name: string }) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("cocowheels:profile-changed", refresh);
    return () =>
      window.removeEventListener("cocowheels:profile-changed", refresh);
  }, []);
  return (
    <span className="participant-name">
      <Image
        src={`/api/profile-photo/${encodeURIComponent(name)}?refresh=${revision}`}
        alt=""
        width={24}
        height={24}
        unoptimized
      />
      <span>{name}</span>
    </span>
  );
}
