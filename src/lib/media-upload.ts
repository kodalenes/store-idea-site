"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_IMAGE_WIDTH = 1920;
const COMPRESS_THRESHOLD_BYTES = 700 * 1024; // 700KB ustundeki PNG/JPEG gorselleri WebP'ye sikistir

async function compressImageIfNeeded(file: File): Promise<{
  blob: Blob;
  fileName: string;
  mimeType: string;
}> {
  const isCompressibleImage =
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp";

  // GIF animasyonlari ve videolar oldugu gibi yuklenir
  if (!isCompressibleImage || file.size <= COMPRESS_THRESHOLD_BYTES) {
    return {
      blob: file,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let targetWidth = img.width;
      let targetHeight = img.height;

      if (targetWidth > MAX_IMAGE_WIDTH) {
        const ratio = MAX_IMAGE_WIDTH / targetWidth;
        targetWidth = MAX_IMAGE_WIDTH;
        targetHeight = Math.round(targetHeight * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ blob: file, fileName: file.name, mimeType: file.type });
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      canvas.toBlob(
        (resultBlob) => {
          if (!resultBlob || resultBlob.size >= file.size) {
            resolve({ blob: file, fileName: file.name, mimeType: file.type });
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          resolve({
            blob: resultBlob,
            fileName: `${baseName}.webp`,
            mimeType: "image/webp",
          });
        },
        "image/webp",
        0.84
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ blob: file, fileName: file.name, mimeType: file.type });
    };

    img.src = objectUrl;
  });
}

export async function uploadStudioMedia(
  targetType: "idea" | "task",
  targetId: string,
  file: File
): Promise<{
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
}> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase bağlantısı yapılandırılmamış.");
  }

  const prepared = await compressImageIfNeeded(file);
  const safeName = prepared.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${targetType}s/${targetId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("studio-media")
    .upload(filePath, prepared.blob, {
      contentType: prepared.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Dosya yüklenemedi: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("studio-media")
    .getPublicUrl(filePath);

  return {
    fileName: prepared.fileName,
    filePath,
    publicUrl: urlData.publicUrl,
    mimeType: prepared.mimeType,
    fileSize: prepared.blob.size,
  };
}
