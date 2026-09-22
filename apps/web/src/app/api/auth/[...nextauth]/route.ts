import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "../../../../server/auth";

export const runtime = "nodejs";

export function GET(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  return NextAuth(request, context, authOptions());
}

export function POST(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  return NextAuth(request, context, authOptions());
}
