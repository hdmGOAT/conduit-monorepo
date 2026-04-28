import axios, { AxiosHeaders } from "axios";
import { NextRequest, NextResponse } from "next/server";

const backendBaseURL = process.env.API_BASE_URL ?? "http://localhost:8080";

export async function proxyAuthPOST(request: NextRequest, targetPath: string) {
  const body = await request.text();

  const response = await axios.post(`${backendBaseURL}${targetPath}`, body, {
    headers: {
      "Content-Type": "application/json",
    },
    validateStatus: () => true,
    responseType: "text",
  });

  const contentType = getHeader(response.headers, "content-type") ?? "application/json";
  const nextResponse = new NextResponse(response.data, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
    },
  });

  const setCookie = response.headers["set-cookie"];
  if (Array.isArray(setCookie)) {
    for (const cookie of setCookie) {
      nextResponse.headers.append("set-cookie", cookie);
    }
  } else if (typeof setCookie === "string") {
    nextResponse.headers.set("set-cookie", setCookie);
  }

  return nextResponse;
}

function getHeader(headers: AxiosHeaders | Record<string, unknown>, key: string): string | undefined {
  if (headers instanceof AxiosHeaders) {
    const value = headers.get(key);
    return typeof value === "string" ? value : undefined;
  }

  const value = headers[key];
  return typeof value === "string" ? value : undefined;
}
