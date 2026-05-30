import "server-only";

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type CloudinaryUploadFolder = "contests/posters" | "contests/banners" | "certificates" | "misc";

function assertCloudinaryConfigured() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }
}

export function cloudinaryFolder(folder: CloudinaryUploadFolder) {
  const root = process.env.CLOUDINARY_FOLDER_ROOT || "dead-coders-society";
  return `${root.replace(/\/+$/, "")}/${folder}`;
}

export async function uploadToCloudinary(file: File, folder: CloudinaryUploadFolder = "misc") {
  assertCloudinaryConfigured();
  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${bytes.toString("base64")}`;
  return uploadDataUriToCloudinary(dataUri, cloudinaryFolder(folder));
}

export async function uploadDataUriToCloudinary(dataUri: string, folder = "dead-coders-society") {
  assertCloudinaryConfigured();
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "auto",
    quality_analysis: true,
    context: {
      app: "the-dead-coders-society",
    },
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function deleteFromCloudinary(publicId?: string | null) {
  if (!publicId) return;
  assertCloudinaryConfigured();
  const imageResult = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  if (imageResult.result === "not found") {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
  }
}
