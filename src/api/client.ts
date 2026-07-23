import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { RateLimiter } from "../utils/rate-limiter.js";
import type { PaginatedResponse, YGFileUpload } from "./types.js";

export class YouGileClient {
  private baseUrl: string;
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, baseUrl = "https://ru.yougile.com/api-v2") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.rateLimiter = new RateLimiter(45, 60_000); // 45 to stay safely under 50
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    await this.rateLimiter.acquire();

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const search = new URLSearchParams(params);
      url += `?${search.toString()}`;
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `YouGile API ${method} ${path} failed: ${res.status} ${res.statusText}. ${text}`
      );
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return {} as T;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  // YouGile has no separate "attachment" object — files are uploaded to
  // storage and you get back a URL, which you then embed yourself as a link
  // or <img> in a task description (HTML) or a chat message (textHtml).
  async uploadFile(filePath: string): Promise<YGFileUpload> {
    await this.rateLimiter.acquire();

    const data = await readFile(filePath);
    const form = new FormData();
    form.append("file", new Blob([data]), basename(filePath));

    const res = await fetch(`${this.baseUrl}/upload-file`, {
      method: "POST",
      // No Content-Type header: fetch sets multipart/form-data with the
      // correct boundary automatically when the body is a FormData instance.
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `YouGile API POST /upload-file failed: ${res.status} ${res.statusText}. ${text}`
      );
    }

    return (await res.json()) as YGFileUpload;
  }

  async getPaginated<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T[]> {
    const all: T[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const p = { ...params, limit: String(limit), offset: String(offset) };
      const res = await this.get<PaginatedResponse<T>>(path, p);
      all.push(...res.content);
      if (res.content.length < limit || !res.paging.next) break;
      offset += limit;
    }

    return all;
  }
}
