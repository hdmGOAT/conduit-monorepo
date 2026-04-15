import { NextRequest, NextResponse } from "next/server";

const backendBaseURL = process.env.API_BASE_URL ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
  const body = await request.text();

  const response = await fetch(`${backendBaseURL}/api/auth/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  const responseBody = await response.text();
  const contentType = response.headers.get("content-type") ?? "application/json";

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
    },
  });
}
