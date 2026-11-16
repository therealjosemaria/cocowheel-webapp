import Image from "next/image";
import Link from "next/link";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "/avatar-photo-guide", "Avatar Photo Guide | GUMWHEEL",
  "How to frame a clear full-body photo for your GUMWHEEL avatar, with a standing example and simple photo tips.",
);

export default function AvatarPhotoGuide() {
  return <section className="activity-page">
    <article className="activity-panel">
      <header className="avatar-guide-heading">
        <Link className="text-button" href="/usual-route?avatar=1">Back</Link>
        <h1 className="page-title">Avatar photo guide</h1>
      </header>
      <div className="help-section avatar-guide-content">
        <figure className="avatar-photo-example">
          <div className="avatar-photo-frame">
            <Image src="/brand/avatar-photo-guide-front-v1.webp" width={128} height={256} unoptimized
              alt="A person standing relaxed and facing straight forward in the centre of a portrait frame, with clear space around their head, hands and feet." />
          </div>
          <figcaption>Leave space around your whole body.</figcaption>
        </figure>
        <section aria-labelledby="avatar-photo-tips">
          <h2 id="avatar-photo-tips">For best results</h2>
          <ul className="avatar-photo-tips">
            <li>Stand upright and relaxed, facing the camera.</li>
            <li>Keep your head, both hands and both feet visible, with space around them. Hold your hands slightly away from your body.</li>
            <li>Use good, even light and a plain background. Avoid blur, other people and objects covering your body.</li>
            <li>Upload the original photo rather than a screenshot or tight crop.</li>
          </ul>
          <p className="avatar-photo-formats">JPG, PNG or WebP. Up to 10 MB, at least 256 pixels wide and 512 pixels tall.</p>
        </section>
      </div>
    </article>
  </section>;
}
