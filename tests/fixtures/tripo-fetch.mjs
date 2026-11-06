import sharp from "sharp";
import { appendFileSync } from "node:fs";
const png = await sharp({
  create: { width: 256, height: 256, channels: 3, background: "white" },
})
  .png()
  .toBuffer();
let index = 0;
globalThis.fetch = async (url, init = {}) => {
  const p = new URL(url).pathname;
  if (p === "/v3/account/balance")
    return Response.json({
      code: 0,
      data: { balance: process.env.TRIPO_TEST_ZERO ? 0 : 1000 },
    });
  if (p === "/v3/account/usage") return Response.json({ code: 0, data: [] });
  if (p === "/v3/files")
    return Response.json({ code: 0, data: { file_token: "file_test" } });
  if (p === "/v3/generation/image-to-model") {
    index++;
    appendFileSync(process.env.TRIPO_TEST_LOG, init.body + "\n");
    if (process.env.TRIPO_TEST_UNCERTAIN)
      throw Error("mock connection lost after submission");
    return Response.json({ code: 0, data: { task_id: `test-${index}` } });
  }
  if (p.startsWith("/v3/tasks/"))
    return Response.json({
      code: 0,
      data: {
        status: "success",
        output: {
          model_url: "https://cdn.tripo3d.ai/mock.glb",
          rendered_image_url: "https://cdn.tripo3d.ai/mock.png",
        },
      },
    });
  if (p === "/mock.glb") return new Response(Buffer.from("glTFtest"));
  if (p === "/mock.png") return new Response(png);
  throw Error("Unexpected network request");
};
