import { z } from "zod";
import { ApiError, sessionToken } from "./api";

export function uploadApi<T>(
  path: string,
  schema: z.ZodType<T>,
  form: FormData,
  onProgress: (value: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/service/${path}`);
    request.timeout = 55000;
    request.setRequestHeader("Authorization", `Bearer ${sessionToken()}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(
        new ApiError(503, "Upload failed. Check your connection and retry."),
      );
    request.ontimeout = () =>
      reject(
        new ApiError(
          503,
          "The backend may be waking up. Retry when the service is ready.",
        ),
      );
    request.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        reject(
          new ApiError(502, "The backend returned an unreadable response."),
        );
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        const error = z
          .object({
            error: z.object({ message: z.string(), code: z.string() }),
          })
          .safeParse(body);
        reject(
          new ApiError(
            request.status,
            error.success
              ? error.data.error.message
              : "Upload could not be processed.",
            error.success ? error.data.error.code : undefined,
          ),
        );
        return;
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success)
        reject(
          new ApiError(
            502,
            "The upload response did not match the API contract.",
          ),
        );
      else resolve(parsed.data);
    };
    request.send(form);
  });
}
