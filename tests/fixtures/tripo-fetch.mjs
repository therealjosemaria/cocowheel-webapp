import sharp from "sharp";
import { appendFileSync } from "node:fs";
const imageTasks = new Map();
const alphaPng = await sharp({ create: { width: 256, height: 512, channels: 4, background: { r: 40, g: 50, b: 60, alpha: 0.5 } } }).png().toBuffer();
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
      data: { balance: process.env.TRIPO_TEST_ZERO ? 0 : Number(process.env.TRIPO_TEST_BALANCE ?? 1000) },
    });
  if (p === "/v3/account/usage") return Response.json({ code: 0, data: [...imageTasks].map(([task_id, model]) => ({ task_id, credits_consumed: model === "seedream_v5" ? 5 : 10 })) });
  if (p === "/v3/files")
    return Response.json({ code: 0, data: { file_token: "file_test" } });
  if (p === "/v3/generation/image-to-model") {
    index++;
    appendFileSync(process.env.TRIPO_TEST_LOG, init.body + "\n");
    if (process.env.TRIPO_TEST_UNCERTAIN)
      throw Error("mock connection lost after submission");
    return Response.json({ code: 0, data: { task_id: `test-${index}` } });
  }
  if (p === "/v3/generation/image-to-image") {
    index++; const body = JSON.parse(init.body);
    appendFileSync(process.env.TRIPO_TEST_LOG, init.body + "\n");
    if (process.env.TRIPO_TEST_UNCERTAIN) throw Error("mock connection lost after submission");
    const id = `image-test-${index}`; imageTasks.set(id, body.model);
    return Response.json({ code: 0, data: { task_id: id } });
  }
  if (p.startsWith("/v3/tasks/image-test-")) {
    const model = imageTasks.get(p.split('/').at(-1));
    return Response.json({ code: 0, data: { status: "success", credits_consumed: model === "seedream_v5" ? 5 : 10,
      output: { generated_image_url: `https://openapi-dl.data.tripo3d.com/${model === 'seedream_v5' ? 'mock' : 'mock-alpha'}.png` } } });
  }
  if (p.startsWith("/v3/tasks/"))
    return Response.json({
      code: 0,
      data: {
        status: "success",
        output: {
          model_url: "https://openapi-dl.data.tripo3d.com/mock.glb",
          rendered_image_url: "https://openapi-dl.data.tripo3d.com/mock.png",
        },
      },
    });
  if (p.startsWith("/mock") && init.headers?.Authorization)
    throw Error("API credential leaked to artifact storage");
  if (p === "/mock.glb") return new Response(Buffer.from("glTFtest"));
  if (p === "/mock.png") return new Response(png);
  if (p === "/mock-alpha.png") return new Response(alphaPng);
  throw Error("Unexpected network request");
};
