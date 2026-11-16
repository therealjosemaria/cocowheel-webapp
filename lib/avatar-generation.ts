// Shared production configuration; trial model selections remain separate.
export const AVATAR_MODEL = "seedream_v5";
export const AVATAR_CREDITS = 5;
export function avatarGenerationPayload(input: string) {
  return { input, model: AVATAR_MODEL, size: "2K", output_format: "png",
    prompt: "Create a polished full-body avatar image of the single person in the reference photo, with subtle 3D-style shading. Preserve their facial identity, face shape, hairstyle, skin tone, clothing, colours and shoes. Keep realistic adult proportions. Show them standing still, waiting, at a slight three-quarter angle, with relaxed visible hands. Keep the entire head and both feet visible with a small clear margin. Centre the person in a portrait 2:3 composition on a completely plain, uniform white background. No scenery, floor, ground shadow, text, accessories or other people. Do not change their outfit or redraw their face into a different identity." };
}
