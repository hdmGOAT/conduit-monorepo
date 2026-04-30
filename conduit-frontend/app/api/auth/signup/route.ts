import { NextRequest } from "next/server";
import { proxyAuthPOST } from "@/lib/api/serverAuthProxy";

export async function POST(request: NextRequest) {
  return proxyAuthPOST(request, "/api/auth/register");
}
