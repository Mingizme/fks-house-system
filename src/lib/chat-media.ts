export function getChatImageThumbnailUrl(url: string, width = 640, quality = 60) {
  try {
    const parsed = new URL(url);
    const objectPath = "/storage/v1/object/public/";

    if (parsed.pathname.includes(objectPath)) {
      parsed.pathname = parsed.pathname.replace(objectPath, "/storage/v1/render/image/public/");
    }

    parsed.searchParams.set("width", String(width));
    parsed.searchParams.set("quality", String(quality));
    parsed.searchParams.set("resize", "contain");
    return parsed.toString();
  } catch {
    return url;
  }
}
